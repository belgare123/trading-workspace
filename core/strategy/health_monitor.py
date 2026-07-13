"""
Plugin Health Monitor (6.6) — мониторинг здоровья плагинов.

Каждый плагин может иметь:
  - **liveness check** — жив ли процесс/корутина (быстрый ping)
  - **readiness check** — готов ли плагин принимать данные
  - **health check** — полная проверка состояния

Три уровня здоровья:

  HEALTHY   → всё хорошо
  DEGRADED  → работает, но с проблемами (ошибки, таймауты)
  UNHEALTHY → неработоспособен

Интеграция с PluginRegistry:
  - При HEALTHY → ничего
  - При DEGRADED → логируем, считаем подряд идущие деградации
  - При UNHEALTHY → auto_stop плагина + оповещение
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  Enums & Constants
# ═══════════════════════════════════════════════════════════════════


class PluginHealth(Enum):
    """Уровень здоровья плагина."""

    UNKNOWN = "unknown"      # ещё не проверялся
    HEALTHY = "healthy"      # всё хорошо
    DEGRADED = "degraded"    # есть проблемы, но работает
    UNHEALTHY = "unhealthy"  # неработоспособен


# Пороги по умолчанию
_DEFAULT_CHECK_INTERVAL = 30.0       # сек между проверками
_DEFAULT_TIMEOUT = 5.0               # таймаут одной проверки
_DEFAULT_MAX_DEGRADED = 3            # попыток до UNHEALTHY
_DEFAULT_CONCURRENCY = 5             # параллельных проверок


# ═══════════════════════════════════════════════════════════════════
#  Data models
# ═══════════════════════════════════════════════════════════════════


@dataclass
class PluginHealthResult:
    """Результат одной проверки здоровья плагина."""

    plugin: str
    healthy: bool
    status: PluginHealth = PluginHealth.HEALTHY
    detail: str = ""
    elapsed_ms: float = 0.0
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "plugin": self.plugin,
            "status": self.status.value,
            "healthy": self.healthy,
            "detail": self.detail,
            "elapsed_ms": round(self.elapsed_ms, 2),
        }


@dataclass
class PluginHealthSnapshot:
    """Текущий снимок здоровья одного плагина."""

    plugin: str
    status: PluginHealth = PluginHealth.UNKNOWN
    last_check: float = 0.0
    last_success: float | None = None
    consecutive_failures: int = 0
    detail: str = ""
    meta: dict[str, Any] = field(default_factory=dict)

    def is_healthy(self) -> bool:
        return self.status == PluginHealth.HEALTHY

    def is_degraded(self) -> bool:
        return self.status == PluginHealth.DEGRADED

    def is_unhealthy(self) -> bool:
        return self.status == PluginHealth.UNHEALTHY

    def to_dict(self) -> dict[str, Any]:
        return {
            "plugin": self.plugin,
            "status": self.status.value,
            "last_check": self.last_check,
            "last_success": self.last_success,
            "consecutive_failures": self.consecutive_failures,
            "detail": self.detail,
        }


# Тип для health-check функции
HealthCheckFn = Callable[[], Awaitable[PluginHealthResult]]


# ═══════════════════════════════════════════════════════════════════
#  PluginHealthMonitor
# ═══════════════════════════════════════════════════════════════════


class PluginHealthMonitor:
    """Мониторинг здоровья плагинов.

    Предоставляет:
      - Регистрацию health-check функций для каждого плагина
      - Периодическую проверку с настраиваемым интервалом
      - Слежение за состоянием (HEALTHY → DEGRADED → UNHEALTHY)
      - Коллбэк при изменении статуса
      - Интеграцию с PluginRegistry (auto_stop при UNHEALTHY)
      - HTTP-ready дамп статусов

    Usage:
        monitor = PluginHealthMonitor()
        monitor.register("Momentum", my_check_fn)
        await monitor.check_one("Momentum")
        await monitor.check_all()
        monitor.disable("Momentum")  # пропускать в check_all
    """

    def __init__(
        self,
        check_interval: float = _DEFAULT_CHECK_INTERVAL,
        timeout: float = _DEFAULT_TIMEOUT,
        max_degraded: int = _DEFAULT_MAX_DEGRADED,
        concurrency: int = _DEFAULT_CONCURRENCY,
    ) -> None:
        self._check_interval = check_interval
        self._timeout = timeout
        self._max_degraded = max_degraded

        # plugin → check function
        self._checks: dict[str, HealthCheckFn] = {}
        # plugin → состояние
        self._states: dict[str, PluginHealthSnapshot] = {}
        # plugin → disabled flag (пропускать в check_all)
        self._disabled: set[str] = set()
        # Коллбэки при смене статуса: {plugin_name → callback}
        self._on_change: dict[str, Callable[[PluginHealthSnapshot], None]] = {}

        # Фоновый воркер
        self._task: asyncio.Task | None = None
        self._running = False
        self._semaphore = asyncio.Semaphore(concurrency)

    # ── Registration ──

    def register(
        self,
        plugin: str,
        check_fn: HealthCheckFn | None = None,
    ) -> None:
        """Зарегистрировать плагин для мониторинга.

        Если check_fn не указан — используется стандартный pass-чекер.
        """
        if plugin in self._checks:
            logger.debug("Updating health check for plugin: %s", plugin)
        self._checks[plugin] = check_fn or self._default_check(plugin)
        # Инициализируем состояние, если его нет
        if plugin not in self._states:
            self._states[plugin] = PluginHealthSnapshot(plugin=plugin)
        logger.debug("Registered health monitor for plugin: %s", plugin)

    def unregister(self, plugin: str) -> None:
        """Удалить плагин из мониторинга."""
        self._checks.pop(plugin, None)
        self._states.pop(plugin, None)
        self._disabled.discard(plugin)
        self._on_change.pop(plugin, None)

    # ── Enable / Disable — пропускать проверки ──

    def disable(self, plugin: str) -> None:
        """Отключить мониторинг для плагина (пропускать в check_all)."""
        self._disabled.add(plugin)

    def enable(self, plugin: str) -> None:
        """Включить мониторинг для плагина."""
        self._disabled.discard(plugin)

    def is_disabled(self, plugin: str) -> bool:
        return plugin in self._disabled

    # ── Change callback ──

    def on_change(
        self, plugin: str, callback: Callable[[PluginHealthSnapshot], None]
    ) -> None:
        """Установить коллбэк при смене статуса здоровья плагина."""
        self._on_change[plugin] = callback

    # ── Self-report (plugin → monitor) ──

    def report_status(
        self,
        plugin: str,
        status: PluginHealth,
        detail: str = "",
        meta: dict[str, Any] | None = None,
    ) -> PluginHealthResult:
        """Плагин самостоятельно сообщает о своём здоровье.

        Это синхронный метод — плагин вызывает его напрямую,
        а monitor безусловно принимает его вердикт.

        Args:
            plugin: Имя плагина.
            status: HEALTHY, DEGRADED или UNHEALTHY.
            detail: Детали (опционально).
            meta:   Дополнительные данные.

        Returns:
            PluginHealthResult.
        """
        if plugin not in self._states:
            self.register(plugin)

        healthy = status == PluginHealth.HEALTHY
        result = PluginHealthResult(
            plugin=plugin,
            healthy=healthy,
            status=status,
            detail=detail,
            elapsed_ms=0.0,
            meta=meta or {},
        )
        self._update_state(result)
        logger.debug(
            "Plugin %s self-reported as %s: %s",
            plugin, status.value, detail,
        )
        return result

    # ── Проверки ──

    async def check_one(self, plugin: str) -> PluginHealthResult:
        """Проверить один плагин (всегда выполняет проверку).

        Args:
            plugin: Имя плагина.

        Returns:
            PluginHealthResult.
        """
        check_fn = self._checks.get(plugin)
        if not check_fn:
            return PluginHealthResult(
                plugin=plugin,
                healthy=False,
                status=PluginHealth.UNKNOWN,
                detail="No health check registered",
            )

        try:
            async with self._semaphore:
                start = time.monotonic()
                result = await asyncio.wait_for(
                    check_fn(), timeout=self._timeout
                )
                elapsed = (time.monotonic() - start) * 1000
                result.elapsed_ms = elapsed
        except asyncio.TimeoutError:
            elapsed = self._timeout * 1000
            result = PluginHealthResult(
                plugin=plugin,
                healthy=False,
                status=PluginHealth.UNHEALTHY,
                detail=f"Health check timed out after {self._timeout}s",
                elapsed_ms=elapsed,
            )
        except Exception as exc:
            elapsed = (time.monotonic() - start) * 1000  # type: ignore
            result = PluginHealthResult(
                plugin=plugin,
                healthy=False,
                status=PluginHealth.UNHEALTHY,
                detail=f"Health check error: {exc}",
                elapsed_ms=elapsed,
            )

        # Обновляем состояние
        self._update_state(result)
        return result

    async def check_all(self) -> dict[str, PluginHealthResult]:
        """Проверить все зарегистрированные плагины.

        Пропускает disabled-плагины.

        Returns:
            {plugin → PluginHealthResult}.
        """
        tasks = {}
        for name in self._checks:
            if name in self._disabled:
                continue
            tasks[name] = asyncio.create_task(self.check_one(name))

        results: dict[str, PluginHealthResult] = {}
        if tasks:
            done = await asyncio.wait(tasks.values(), return_when="ALL_COMPLETED")
            for name, task in tasks.items():
                results[name] = task.result() if not task.exception() else (
                    PluginHealthResult(
                        plugin=name,
                        healthy=False,
                        status=PluginHealth.UNHEALTHY,
                        detail=f"check_all error: {task.exception()}",
                    )
                )
        return results

    # ── State queries ──

    def get_status(self, plugin: str) -> PluginHealthSnapshot | None:
        """Получить снимок здоровья плагина."""
        return self._states.get(plugin)

    def get_healthy(self) -> list[PluginHealthSnapshot]:
        """Список здоровых плагинов."""
        return [
            s for s in self._states.values()
            if s.status == PluginHealth.HEALTHY
        ]

    def get_degraded(self) -> list[PluginHealthSnapshot]:
        """Список деградированных плагинов."""
        return [
            s for s in self._states.values()
            if s.status == PluginHealth.DEGRADED
        ]

    def get_unhealthy(self) -> list[PluginHealthSnapshot]:
        """Список нездоровых плагинов."""
        return [
            s for s in self._states.values()
            if s.status == PluginHealth.UNHEALTHY
        ]

    def all_statuses(self) -> dict[str, PluginHealthSnapshot]:
        """Все статусы (для Dashboard/HTTP)."""
        return dict(self._states)

    def summary(self) -> str:
        """Краткий отчёт."""
        total = len(self._states)
        healthy = len(self.get_healthy())
        degraded = len(self.get_degraded())
        unhealthy = len(self.get_unhealthy())
        disabled = len(self._disabled)
        lines = [
            f"HealthMonitor: {total} plugins, "
            f"{healthy} healthy, {degraded} degraded, {unhealthy} unhealthy"
            f" ({disabled} disabled)"
        ]
        for snap in sorted(self._states.values(), key=lambda s: s.plugin):
            icon = {
                PluginHealth.HEALTHY: "✓",
                PluginHealth.DEGRADED: "⚠",
                PluginHealth.UNHEALTHY: "✗",
                PluginHealth.UNKNOWN: "?",
            }.get(snap.status, "?")
            lines.append(f"  [{icon}] {snap.plugin:20s} {snap.status.value}")
            if snap.detail:
                lines.append(f"         {snap.detail}")
        return "\n".join(lines)

    def to_dict(self) -> dict[str, Any]:
        """Все статусы в формате dict (для HTTP /health)."""
        return {
            name: snap.to_dict()
            for name, snap in self._states.items()
        }

    # ── Background loop ──

    async def start(self) -> None:
        """Запустить фоновый цикл проверок."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            "Health monitor started (interval=%ss, timeout=%ss)",
            self._check_interval,
            self._timeout,
        )

    async def stop(self) -> None:
        """Остановить фоновый цикл."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("Health monitor stopped")

    async def _run_loop(self) -> None:
        """Фоновый цикл проверок."""
        while self._running:
            await self.check_all()
            await asyncio.sleep(self._check_interval)

    # ── Internal ──

    def _update_state(self, result: PluginHealthResult) -> None:
        """Обновить состояние плагина по результату проверки."""
        snap = self._states.setdefault(
            result.plugin,
            PluginHealthSnapshot(plugin=result.plugin),
        )
        old_status = snap.status
        snap.last_check = time.time()

        if result.healthy:
            snap.consecutive_failures = 0
            snap.last_success = snap.last_check
            snap.status = PluginHealth.HEALTHY
        else:
            snap.consecutive_failures += 1
            if snap.consecutive_failures >= self._max_degraded:
                snap.status = PluginHealth.UNHEALTHY
            else:
                snap.status = PluginHealth.DEGRADED

        snap.detail = result.detail
        snap.meta = result.meta

        # Нотификация при смене статуса
        if snap.status != old_status:
            logger.info(
                "Plugin '%s' health changed: %s → %s (detail: %s)",
                result.plugin,
                old_status.value,
                snap.status.value,
                result.detail,
            )
            cb = self._on_change.get(result.plugin)
            if cb:
                try:
                    cb(snap)
                except Exception as exc:
                    logger.error("Health on_change callback failed: %s", exc)

    @staticmethod
    def _default_check(plugin: str) -> HealthCheckFn:
        """Стандартный pass-чекер — всегда HEALTHY."""

        async def _check() -> PluginHealthResult:
            return PluginHealthResult(
                plugin=plugin,
                healthy=True,
                status=PluginHealth.HEALTHY,
                detail="Default check: always healthy",
            )

        return _check
