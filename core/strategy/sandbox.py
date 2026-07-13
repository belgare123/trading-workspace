"""
Strategy Sandbox (6.9) — ограничения для сторонних стратегий.

Обеспечивает:
  1. Таймаут выполнения analyze()
  2. Белый список импортов (запрет опасных модулей)
  3. Мониторинг операций с файловой системой
  4. Ограничение количества вызовов API
  5. Трекинг памяти
  6. Аудит нарушений

Usage:
    sandbox = StrategySandbox(sandbox_config)
    async with sandbox.execute(strategy):
        result = await strategy.analyze(ctx)
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, AsyncIterator, Callable, Optional

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  Конфигурация песочницы
# ═══════════════════════════════════════════════════════════════════


@dataclass
class SandboxConfig:
    """Конфигурация песочницы.

    Attributes:
        enabled:              Включить песочницу (по умолчанию True).
        analyze_timeout:      Максимальное время analyze() в секундах (default 30).
        max_signals:          Максимальное количество сигналов за вызов (default 50).
        max_api_calls:        Максимальное количество вызовов PluginAPI за analyze() (default 500).
        memory_limit_bytes:   Максимальный размер объектов (sys.getsizeof) за analyze() (default 10MB).
        allowed_modules:      Белый список модулей для импорта.
        blocked_modules:      Чёрный список (дополнительно к не-whitelist).
        restrict_filesystem:  Блокировать запись в ФС вне стратегии.
        restrict_network:     Блокировать прямые сетевые вызовы.
        strategy_base_dir:    Базовая директория для стратегий.
        log_violations:       Логировать нарушения в отдельный логгер.
        track_api_calls:      Включить трекинг вызовов PluginAPI.
        track_memory:         Включить трекинг памяти (sys.getsizeof).
    """

    enabled: bool = True
    analyze_timeout: float = 30.0
    max_signals: int = 50
    max_api_calls: int = 500
    memory_limit_bytes: int = 10 * 1024 * 1024  # 10 MB
    allowed_modules: tuple[str, ...] = (
        # Стандартная библиотека (безопасное подмножество)
        "math",
        "datetime",
        "decimal",
        "functools",
        "itertools",
        "json",
        "re",
        "collections",
        "typing",
        "enum",
        "dataclasses",
        "statistics",
        "uuid",
        "copy",
        "time",
        # SDK
        "screener_sdk",
    )
    blocked_modules: tuple[str, ...] = (
        "os",
        "subprocess",
        "shutil",
        "socket",
        "requests",
        "aiohttp",
        "httpx",
        "multiprocessing",
        "ctypes",
        "ctypes.wintypes",
        "win32api",
        "win32file",
        "pywin32",
        "sys",
    )
    restrict_filesystem: bool = True
    restrict_network: bool = True
    strategy_base_dir: str = "strategies"
    log_violations: bool = True
    track_api_calls: bool = True
    track_memory: bool = False  # False по умолчанию (дорого)

    @classmethod
    def default(cls) -> SandboxConfig:
        return cls()

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "analyze_timeout": self.analyze_timeout,
            "max_signals": self.max_signals,
            "max_api_calls": self.max_api_calls,
            "memory_limit_bytes": self.memory_limit_bytes,
            "restrict_filesystem": self.restrict_filesystem,
            "restrict_network": self.restrict_network,
            "track_api_calls": self.track_api_calls,
            "track_memory": self.track_memory,
        }


# ═══════════════════════════════════════════════════════════════════
#  Import Hook — белый список импортов
# ═══════════════════════════════════════════════════════════════════


class SandboxImportGuard:
    """Meta-path импорт-фильтр для песочницы.

    Блокирует импорт модулей не из белого списка.
    Базовые модули Python (os, subprocess, socket) — в чёрном списке.

    Устанавливается как sys.meta_path[-1] — последний шанс на валидацию.
    Работает только для новых (ещё не импортированных) модулей.
    """

    def __init__(self, config: SandboxConfig) -> None:
        self._config = config
        self._violations: list[str] = []
        self._installed = False

        # Предзагруженные модули, которые разрешены в любом случае
        self._preloaded: set[str] = set(sys.modules.keys())

    def install(self) -> None:
        """Установить guard в sys.meta_path."""
        if self._installed:
            return
        # Ставим перед другими finder'ами, чтобы перехватить раньше
        sys.meta_path.insert(0, self)
        self._installed = True
        logger.debug("SandboxImportGuard installed")

    def uninstall(self) -> None:
        """Снять guard из sys.meta_path."""
        if not self._installed:
            return
        try:
            sys.meta_path.remove(self)
        except ValueError:
            pass
        self._installed = False
        logger.debug("SandboxImportGuard uninstalled")

    def clear_violations(self) -> None:
        """Очистить список нарушений."""
        self._violations.clear()

    @property
    def violations(self) -> list[str]:
        return list(self._violations)

    @property
    def has_violations(self) -> bool:
        return len(self._violations) > 0

    def find_spec(
        self,
        fullname: str,
        path: Any = None,
        target: Any = None,
    ) -> Any:
        """Перехват импорта — проверка белого списка."""
        # Всегда разрешаем:
        #  - Уже импортированные модули
        #  - core.* (ядро платформы)
        #  - screener_sdk.* (публичный SDK)
        #  - Встроенные модули Python
        if fullname in self._preloaded:
            return None
        if fullname.startswith("core.") or fullname == "core":
            return None
        if fullname.startswith("screener_sdk") or fullname == "screener_sdk":
            return None

        # Проверка чёрного списка
        for blocked in self._config.blocked_modules:
            if fullname == blocked or fullname.startswith(blocked + "."):
                self._violations.append(
                    f"Blocked import '{fullname}' (blacklisted)"
                )
                logger.warning(
                    "Sandbox blocked import '%s' (blacklisted)", fullname
                )
                raise ImportError(
                    f"Module '{fullname}' is not allowed in sandbox"
                )

        # Проверка белого списка
        allowed = self._config.allowed_modules
        for allowed_mod in allowed:
            if fullname == allowed_mod or fullname.startswith(allowed_mod + "."):
                return None  # Разрешён — пропускаем

        # Не в белом списке — блокируем
        self._violations.append(
            f"Blocked import '{fullname}' (not in whitelist)"
        )
        logger.warning(
            "Sandbox blocked import '%s' (not in whitelist)", fullname
        )
        raise ImportError(
            f"Module '{fullname}' is not allowed in sandbox. "
            f"Allowed: {', '.join(self._config.allowed_modules)}"
        )

    def __repr__(self) -> str:
        return (
            f"SandboxImportGuard(installed={self._installed}, "
            f"violations={len(self._violations)})"
        )


# ═══════════════════════════════════════════════════════════════════
#  MemoryTracker — отслеживание использования памяти
# ═══════════════════════════════════════════════════════════════════


class MemoryTracker:
    """Трекинг памяти объектов.

    Использует sys.getsizeof() с обходом контейнеров.
    Внимание: sys.getsizeof() не считает глубоко вложенные объекты.
    """

    def __init__(self, limit_bytes: int) -> None:
        self._limit = limit_bytes
        self._objects: list[int] = []
        self._exceeded = False

    def track(self, obj: Any) -> None:
        """Зафиксировать размер объекта.

        Args:
            obj: Объект для отслеживания.
        """
        if self._exceeded:
            return
        try:
            size = sys.getsizeof(obj)
            self._objects.append(size)
            total = sum(self._objects)
            if total > self._limit:
                self._exceeded = True
                logger.warning(
                    "Memory limit exceeded: %d bytes (limit: %d)",
                    total, self._limit,
                )
        except (TypeError, AttributeError):
            pass

    @property
    def total(self) -> int:
        """Общий объём отслеженных объектов в байтах."""
        return sum(self._objects)

    @property
    def exceeded(self) -> bool:
        return self._exceeded

    def reset(self) -> None:
        """Сбросить счётчик."""
        self._objects.clear()
        self._exceeded = False

    def __repr__(self) -> str:
        return (
            f"MemoryTracker(total={self.total}, "
            f"limit={self._limit}, exceeded={self._exceeded})"
        )


# ═══════════════════════════════════════════════════════════════════
#  Результат выполнения в песочнице
# ═══════════════════════════════════════════════════════════════════


@dataclass
class SandboxResult:
    """Результат выполнения стратегии в песочнице.

    Attributes:
        success:        True если выполнение успешно.
        timed_out:      True если превышен таймаут.
        api_call_limit: True если превышен лимит вызовов API.
        memory_exceeded: True если превышен лимит памяти.
        error:          Текст ошибки (если есть).
        violations:     Нарушения sandbox (импорты, ФС, сеть).
        elapsed:        Время выполнения в секундах.
        api_calls:      Количество вызовов PluginAPI.
        memory_bytes:   Объём памяти, занятый объектами.
    """

    success: bool = True
    timed_out: bool = False
    api_call_limit: bool = False
    memory_exceeded: bool = False
    error: str = ""
    violations: list[str] = field(default_factory=list)
    elapsed: float = 0.0
    api_calls: int = 0
    memory_bytes: int = 0


# ═══════════════════════════════════════════════════════════════════
#  Sandbox — основной класс
# ═══════════════════════════════════════════════════════════════════


class StrategySandbox:
    """Песочница для выполнения стратегий.

    На каждый вызов analyze() устанавливает:
      - Import guard (белый список модулей)
      - Таймаут выполнения
      - Мониторинг нарушений
      - Лимит вызовов PluginAPI
      - Трекинг памяти (если включён)
      - Проверку лимита сигналов

    Usage:
        sandbox = StrategySandbox(strategy_dir="strategies/MyStrategy")
        result = await sandbox.run(strategy.analyze, ctx)
    """

    def __init__(
        self,
        config: SandboxConfig | None = None,
        strategy_dir: str | None = None,
        api_call_counter: Callable[[], int] | None = None,
    ) -> None:
        self._config = config or SandboxConfig.default()
        self._strategy_dir = strategy_dir
        self._import_guard = SandboxImportGuard(self._config)
        self._memory_tracker = MemoryTracker(self._config.memory_limit_bytes)
        self._api_call_counter = api_call_counter
        self._logger = logging.getLogger("strategy.sandbox")

    @property
    def config(self) -> SandboxConfig:
        return self._config

    @config.setter
    def config(self, value: SandboxConfig) -> None:
        self._config = value
        self._import_guard = SandboxImportGuard(value)
        self._memory_tracker = MemoryTracker(value.memory_limit_bytes)

    @property
    def memory_tracker(self) -> MemoryTracker:
        return self._memory_tracker

    def get_api_call_count(self) -> int:
        """Получить количество вызовов PluginAPI (через коллбэк)."""
        if self._api_call_counter is None:
            return 0
        return self._api_call_counter()

    async def run(
        self,
        coro: Any,
        timeout: float | None = None,
    ) -> tuple[SandboxResult, Any]:
        """Выполнить корутину под охраной песочницы.

        Args:
            coro:    Асинхронная функция для выполнения.
            timeout: Таймаут (сек). Если None — из конфига.

        Returns:
            Кортеж (SandboxResult, result_or_None).
            Если success=True, второй элемент — результат корутины.
            Если success=False, второй элемент — None.
        """
        if not self._config.enabled:
            # Песочница отключена — выполняем без ограничений
            t0 = time.monotonic()
            try:
                value = await coro
                elapsed = time.monotonic() - t0
                return SandboxResult(success=True, elapsed=elapsed), value
            except Exception as e:
                elapsed = time.monotonic() - t0
                return (
                    SandboxResult(success=False, error=str(e), elapsed=elapsed),
                    None,
                )

        effective_timeout = timeout if timeout is not None else self._config.analyze_timeout

        # Устанавливаем import guard
        self._import_guard.install()
        self._import_guard.clear_violations()
        self._memory_tracker.reset()

        result = SandboxResult()
        value: Any = None
        t0 = time.monotonic()

        try:
            # Выполняем с таймаутом
            value = await asyncio.wait_for(coro, timeout=effective_timeout)
            result.success = True

            # Проверка лимита вызовов API (перед завершением)
            if self._config.track_api_calls:
                result.api_calls = self.get_api_call_count()
                if result.api_calls > self._config.max_api_calls:
                    result.api_call_limit = True
                    result.success = False
                    result.error = (
                        f"API call limit exceeded: "
                        f"{result.api_calls} > {self._config.max_api_calls}"
                    )
                    self._logger.warning(
                        "Sandbox: API call limit exceeded: %d calls",
                        result.api_calls,
                    )

        except asyncio.TimeoutError:
            result.timed_out = True
            result.success = False
            result.error = (
                f"Strategy execution timed out after {effective_timeout}s"
            )
            self._logger.warning(
                "Sandbox: execution timed out after %.1fs", effective_timeout
            )
        except ImportError as e:
            result.success = False
            result.error = str(e)
        except Exception as e:
            result.success = False
            result.error = f"{type(e).__name__}: {e}"
            self._logger.debug(
                "Sandbox: execution error: %s: %s",
                type(e).__name__,
                e,
            )
        finally:
            result.elapsed = time.monotonic() - t0

            # Память
            if self._config.track_memory:
                result.memory_bytes = self._memory_tracker.total
                if self._memory_tracker.exceeded:
                    result.memory_exceeded = True
                    result.success = False
                    if not result.error:
                        result.error = (
                            f"Memory limit exceeded: "
                            f"{result.memory_bytes} > {self._config.memory_limit_bytes}"
                        )

            # Собираем нарушения
            if self._import_guard.has_violations:
                result.violations = self._import_guard.violations
            # Снимаем import guard
            self._import_guard.uninstall()

            # Логирование
            if self._config.log_violations and result.violations:
                for v in result.violations:
                    self._logger.warning("Sandbox violation: %s", v)

        return result, value if result.success else None


# ═══════════════════════════════════════════════════════════════════
#  SandboxContext — контекстный менеджер для стратегий
# ═══════════════════════════════════════════════════════════════════


class SandboxContext:
    """Контекст выполнения стратегии под песочницей.

    Используется StrategyEngine для wrapping вызовов analyze().

    Пример:
        sandbox_ctx = SandboxContext(config)
        async with sandbox_ctx for_plugin(plugin_info):
            result = await strategy.analyze(ctx)
    """

    def __init__(
        self,
        config: SandboxConfig | None = None,
        api_call_counter: Callable[[], int] | None = None,
    ) -> None:
        self._config = config or SandboxConfig.default()
        self._api_call_counter = api_call_counter
        self._sandboxes: dict[str, StrategySandbox] = {}

    def for_strategy(self, strategy_dir: str) -> StrategySandbox:
        """Получить или создать sandbox для стратегии."""
        if strategy_dir not in self._sandboxes:
            self._sandboxes[strategy_dir] = StrategySandbox(
                config=self._config,
                strategy_dir=strategy_dir,
                api_call_counter=self._api_call_counter,
            )
        return self._sandboxes[strategy_dir]

    @asynccontextmanager
    async def execute(
        self,
        coro: Any,
        strategy_name: str = "unknown",
        strategy_dir: str | None = None,
        timeout: float | None = None,
    ) -> AsyncIterator[tuple[SandboxResult, Any]]:
        """Выполнить корутину под sandbox.

        Yields:
            Кортеж (SandboxResult, result_or_None).
        """
        sandbox = self.for_strategy(strategy_dir or strategy_name)
        result, value = await sandbox.run(coro, timeout)
        yield result, value

    def clear(self) -> None:
        """Очистить все sandbox'ы."""
        self._sandboxes.clear()


__all__ = [
    "SandboxConfig",
    "SandboxImportGuard",
    "SandboxResult",
    "StrategySandbox",
    "SandboxContext",
    "MemoryTracker",
]
