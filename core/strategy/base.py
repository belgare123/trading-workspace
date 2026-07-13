"""
BaseStrategy — базовая реализация стратегии.

Предоставляет готовую реализацию всего lifecycle.
Пользователь наследует BaseStrategy и пишет только analyze().

Пример стратегии:
    from core.strategy import BaseStrategy, StrategyContext, SignalBundle

    class MomentumStrategy(BaseStrategy):
        async def analyze(self, ctx: StrategyContext) -> SignalBundle:
            candles = await ctx.features.get_candles("BTC/USDT")
            # ... логика стратегии ...
            return SignalBundle(strategy=self.name, signals=[...])
"""

from __future__ import annotations

import logging
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from core.app.phases import Phase
from core.strategy.context import StrategyConfig, StrategyContext
from core.strategy.descriptor import ManifestLoader, StrategyDescriptor, Permission
from core.strategy.lifecycle import (
    InvalidTransitionError,
    StatusTransition,
    StrategyState,
)
from core.strategy.signal import SignalBundle
from core.strategy.benchmark import StrategyBenchmark


# ═══════════════════════════════════════════════════════════════════
# StrategyMetrics — статистика стратегии (внутренняя)
# ═══════════════════════════════════════════════════════════════════


@dataclass
class StrategyMetrics:
    """Внутренняя статистика стратегии.

    Автоматически обновляется BaseStrategy при каждом вызове analyze().
    """

    # ── Счётчики ──
    initialize_count: int = 0
    start_count: int = 0
    stop_count: int = 0
    shutdown_count: int = 0
    analyze_count: int = 0
    warmup_count: int = 0
    reset_count: int = 0
    error_count: int = 0
    signal_count: int = 0
    actionable_count: int = 0

    # ── Время ──
    uptime_start: float = 0.0
    total_analyze_ms: float = 0.0
    last_analyze_ms: float = 0.0
    last_signal_time: float = 0.0

    # ── Scores ──
    total_score: float = 0.0
    total_confidence: float = 0.0
    max_score: float = 0.0
    max_confidence: float = 0.0

    @property
    def uptime_seconds(self) -> float:
        if self.uptime_start == 0:
            return 0.0
        return time.time() - self.uptime_start

    @property
    def avg_score(self) -> float:
        if self.analyze_count == 0:
            return 0.0
        return round(self.total_score / self.analyze_count, 1)

    @property
    def avg_confidence(self) -> float:
        if self.signal_count == 0:
            return 0.0
        return round(self.total_confidence / self.signal_count, 1)

    @property
    def avg_analyze_ms(self) -> float:
        if self.analyze_count == 0:
            return 0.0
        return round(self.total_analyze_ms / self.analyze_count, 2)

    @property
    def error_rate(self) -> float:
        total = self.analyze_count + self.error_count
        if total == 0:
            return 0.0
        return round(self.error_count / total, 4)

    def record_analyze(self, elapsed_ms: float, bundle: SignalBundle) -> None:
        """Записать результаты одного вызова analyze()."""
        self.analyze_count += 1
        self.total_analyze_ms += elapsed_ms
        self.last_analyze_ms = elapsed_ms

        for sig in bundle.signals:
            self.signal_count += 1
            self.total_score += sig.score
            self.total_confidence += sig.confidence
            self.max_score = max(self.max_score, sig.score)
            self.max_confidence = max(self.max_confidence, sig.confidence)
            if sig.is_actionable:
                self.actionable_count += 1

        if bundle.signals:
            self.last_signal_time = time.time()

    def record_error(self) -> None:
        self.error_count += 1

    def reset(self) -> None:
        """Сброс метрик (при reset() стратегии)."""
        self.initialize_count = 0
        self.start_count = 0
        self.stop_count = 0
        self.shutdown_count = 0
        self.analyze_count = 0
        self.warmup_count = 0
        self.reset_count += 1
        self.error_count = 0
        self.signal_count = 0
        self.actionable_count = 0
        self.total_analyze_ms = 0.0
        self.last_analyze_ms = 0.0
        self.last_signal_time = 0.0
        self.total_score = 0.0
        self.total_confidence = 0.0
        self.max_score = 0.0
        self.max_confidence = 0.0

    def to_dict(self) -> dict[str, object]:
        return {
            "uptime_seconds": round(self.uptime_seconds, 1),
            "analyze_count": self.analyze_count,
            "signal_count": self.signal_count,
            "actionable_count": self.actionable_count,
            "error_count": self.error_count,
            "error_rate": self.error_rate,
            "avg_analyze_ms": self.avg_analyze_ms,
            "avg_score": self.avg_score,
            "avg_confidence": self.avg_confidence,
            "max_score": self.max_score,
            "max_confidence": self.max_confidence,
        }


@dataclass
class StrategyInfo:
    """Публичная мета-информация о стратегии (strategy.info()).

    Безопасна для вызова без загрузки Python-кода стратегии.
    Все данные берутся из manifest.yaml и runtime-статистики.

    Attributes:
        name:        Имя стратегии.
        version:     Версия (из manifest).
        author:      Автор.
        description: Описание.
        category:    Категория.
        api_version: Версия API платформы.
        homepage:    URL проекта.
        repository:  URL репозитория.
        license:     SPDX-лицензия.
        exchange:    Поддерживаемые биржи.
        markets:     Типы рынков.
        timeframes:  Таймфреймы.
        tags:        Теги.
        capabilities: Признаки.
        permissions: Разрешения.
        profile:     Поведенческий профиль (если есть).

        # ── Runtime ──
        state:          Текущее состояние lifecycle.
        uptime:         Время работы (сек).
        analyze_count:  Количество вызовов analyze().
        signal_count:   Всего сигналов.
        error_count:    Ошибок.
        avg_analyze_ms: Среднее время analyze().
        avg_score:      Средний score сигналов.
        last_signal:    Время последнего сигнала (timestamp или 0).
    """

    # ── Manifest ──
    name: str
    version: str
    author: str
    description: str = ""
    category: str = "custom"
    api_version: str = ""
    homepage: str = ""
    repository: str = ""
    license: str = ""
    exchange: list[str] = field(default_factory=list)
    markets: list[str] = field(default_factory=list)
    timeframes: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    capabilities: list[str] = field(default_factory=list)
    permissions: list[str] = field(default_factory=list)
    profile: dict[str, object] | None = None
    parameters: dict[str, object] = field(default_factory=dict)

    # ── Runtime ──
    state: str = ""
    uptime: float = 0.0
    analyze_count: int = 0
    signal_count: int = 0
    error_count: int = 0
    error_rate: float = 0.0
    avg_analyze_ms: float = 0.0
    avg_score: float = 0.0
    last_signal: float = 0.0
    config_schema: Any = None

    def to_dict(self) -> dict[str, object]:
        """Сериализация в dict для JSON/Dashboard."""
        d: dict[str, object] = {
            "name": self.name,
            "version": self.version,
            "author": self.author,
            "description": self.description,
            "category": self.category,
            "api_version": self.api_version,
            "homepage": self.homepage,
            "repository": self.repository,
            "license": self.license,
            "exchange": list(self.exchange),
            "markets": list(self.markets),
            "timeframes": list(self.timeframes),
            "tags": list(self.tags),
            "capabilities": list(self.capabilities),
            "permissions": list(self.permissions),
            "state": self.state,
            "uptime": self.uptime,
            "analyze_count": self.analyze_count,
            "signal_count": self.signal_count,
            "error_count": self.error_count,
            "error_rate": self.error_rate,
            "avg_analyze_ms": self.avg_analyze_ms,
            "avg_score": self.avg_score,
            "last_signal": self.last_signal,
        }
        if self.profile is not None:
            d["profile"] = self.profile
        if self.parameters:
            d["parameters"] = self.parameters
        if self.config_schema is not None:
            d["config_schema"] = self.config_schema
        return d

    def __repr__(self) -> str:
        return (
            f"StrategyInfo(name={self.name!r}, v{self.version}, "
            f"state={self.state}, signals={self.signal_count})"
        )


# ═══════════════════════════════════════════════════════════════════
# BaseStrategy
# ═══════════════════════════════════════════════════════════════════


class BaseStrategy(ABC):
    """Базовая реализация стратегии.

    Готовая реализация всего lifecycle. Пользователь наследует и
    переопределяет только analyze().

    Автоматически умеет:
      ✓ Читать manifest.yaml через ManifestLoader
      ✓ Читать config.yaml (опционально)
      ✓ Управлять lifecycle (StrategyState + StatusTransition)
      ✓ Считать uptime и статистику
      ✓ Логировать ключевые события
      ✓ Отдавать health() и metrics() для Dashboard

    Пример:
        class MomentumStrategy(BaseStrategy):
            async def analyze(self, ctx: StrategyContext) -> SignalBundle:
                ...
    """

    # ── Пользователь должен переопределить ──
    name: str

    # ── Совместимость с IService (ServiceRuntime) ──
    phase: Phase = Phase.STRATEGY

    def __init__(
        self,
        name: str | None = None,
        manifest_path: str | None = None,
        config_data: dict[str, Any] | None = None,
    ) -> None:
        """Инициализация стратегии.

        Args:
            name:          Имя стратегии. Если не указано — читается из manifest.
            manifest_path: Путь к manifest.yaml. Если не указан —
                           ищется по пути стратегии.
            config_data:   Настройки стратегии (config.yaml).
                           Могут быть переданы Engine позже.
        """
        # ── Core ──
        self._name = name or self.__class__.__name__
        self._state: StrategyState = StrategyState.DISCOVERED
        self._context: Optional[StrategyContext] = None
        self._manifest: Optional[StrategyDescriptor] = None
        self._config: StrategyConfig = StrategyConfig.from_dict(config_data or {})
        self._manifest_path = manifest_path

        # ── Metrics ──
        self._metrics = StrategyMetrics()
        self._benchmark = StrategyBenchmark(name=self._name)

        # ── Logging ──
        self._logger = logging.getLogger(f"strategy.{self._name}")
        self._logger.info(f"Strategy created (state={self._state.value})")

        # ── ID ──
        self._instance_id = uuid.uuid4().hex[:8]

    # ── Public properties ─────────────────────────────────────────

    @property
    def name(self) -> str:
        return self._name

    @property
    def state(self) -> str:
        return self._state.value

    @property
    def context(self) -> Optional[StrategyContext]:
        return self._context

    @property
    def manifest(self) -> Optional[StrategyDescriptor]:
        return self._manifest

    @property
    def config(self) -> StrategyConfig:
        return self._config

    @property
    def instance_id(self) -> str:
        return self._instance_id

    @property
    def is_running(self) -> bool:
        return self._state == StrategyState.RUNNING

    @property
    def is_healthy(self) -> bool:
        return self._state not in (
            StrategyState.FAILED,
            StrategyState.REMOVED,
        )

    @property
    def capabilities(self) -> list[str]:
        if self._manifest:
            return list(self._manifest.capabilities)
        return []

    # ── State transitions ────────────────────────────────────────

    def _transition(self, to_state: StrategyState) -> None:
        """Безопасный переход состояния.

        Проверяет валидность через StatusTransition и обновляет state.
        Логирует ошибку если переход невалиден.
        """
        try:
            StatusTransition.validate(self._name, self._state, to_state)
            old_state = self._state
            self._state = to_state
            self._logger.info(
                f"State: {old_state.value} → {to_state.value}"
            )
        except InvalidTransitionError as e:
            self._logger.error(f"Invalid state transition: {e}")
            # Если переход невалиден — уходим в FAILED
            self._state = StrategyState.FAILED
            raise

    # ── Lifecycle ─────────────────────────────────────────────────

    def _try_load_manifest(self) -> None:
        """Попытка загрузить manifest.yaml.

        Использует ManifestLoader.from_file() для чтения и валидации.
        Если manifest найден — обновляет _name и _manifest.
        """
        if self._manifest_path:
            try:
                self._manifest = ManifestLoader.from_file(self._manifest_path)
                self._name = self._manifest.name
                self._logger.info(
                    f"Loaded manifest: {self._manifest.name} v{self._manifest.version}"
                )
            except Exception as e:
                self._logger.warning(f"Cannot load manifest: {e}")

    async def initialize(self, ctx: Optional[StrategyContext] = None) -> None:
        """Инициализация стратегии.

        1. Пытается загрузить manifest.yaml
        2. Сохраняет контекст
        3. Устанавливает config из контекста (если есть)
        4. Переходит в LOADED → INITIALIZED
        5. Вызывает configure() как hook

        Args:
            ctx: Контекст стратегии. Если не передан — стратегия
                 будет работать без контекста (для тестов).
        """
        if self._state != StrategyState.DISCOVERED:
            # Пропускаем если уже инициализирована (restart)
            self._logger.info(
                f"Initialize skipped (current state={self._state.value})"
            )
            return

        # 1. Загружаем manifest
        self._try_load_manifest()

        # 2. DISCOVERED → VALIDATED → INSTALLED
        self._transition(StrategyState.VALIDATED)
        self._transition(StrategyState.INSTALLED)

        # 3. Сохраняем контекст
        self._context = ctx

        # 4. Применяем config из контекста
        if ctx is not None and ctx.config:
            self._config = ctx.config

        # 4b. Валидация config по схеме
        if self._manifest and self._manifest.config_schema is not None:
            from core.strategy.config_schema import normalize_config, validate_config_with_schema

            schema = self._manifest.config_schema
            cfg = self._config or {}
            errors = validate_config_with_schema(cfg, schema, source=self.name)
            if errors:
                for err in errors:
                    self._logger.warning(f"Config validation: {err}")
                # Не блокируем — warn, не fail

            # Нормализуем config (дефолты + приведение типов)
            self._config = normalize_config(cfg, schema)

        # 5. LOADED → INITIALIZED
        self._transition(StrategyState.INITIALIZED)

        # 6. Hook для пользователя
        if ctx is not None:
            await self._on_configure(ctx)

        self._metrics.initialize_count += 1
        self._logger.info("Strategy initialized")

    async def warmup(self, data: Any | None = None) -> None:
        """Прогрев стратегии (опционально).

        По умолчанию просто логирует количество сигналов из data.
        Пользователь может переопределить для загрузки истории.
        """
        self._metrics.warmup_count += 1
        count = 0
        if hasattr(data, "__len__"):
            count = len(data)  # type: ignore[arg-type]
        self._logger.info(f"Warmup completed ({count} data points)")

    async def start(self) -> None:
        """Запуск стратегии.

        INITIALIZED/STOPPED → RUNNING
        Запускает отсчёт uptime.
        """
        if self._state not in (StrategyState.INITIALIZED, StrategyState.STOPPED):
            self._logger.warning(
                f"Cannot start from state={self._state.value}"
            )
            return

        self._transition(StrategyState.RUNNING)

        self._metrics.uptime_start = time.time()
        self._metrics.start_count += 1
        self._logger.info("Strategy started")

    @abstractmethod
    async def analyze(self, ctx: StrategyContext) -> SignalBundle:
        """Главный метод — вычисление сигналов.

        Единственный метод, который пользователь ОБЯЗАН реализовать.

        Args:
            ctx: Актуальный контекст с текущими данными.

        Returns:
            SignalBundle — может быть пустым.
        """
        ...

    async def stop(self) -> None:
        """Остановка стратегии.

        RUNNING / PAUSED → STOPPED
        Останавливает отсчёт uptime.
        """
        if self._state not in (StrategyState.RUNNING, StrategyState.PAUSED):
            self._logger.info(f"Stop skipped (state={self._state.value})")
            return

        self._transition(StrategyState.STOPPED)
        self._metrics.stop_count += 1
        self._logger.info(f"Strategy stopped (uptime={self._metrics.uptime_seconds:.0f}s)")

    async def shutdown(self) -> None:
        """Финальное завершение.

        Любое non-terminal состояние → STOPPED → REMOVED.
        """
        if self._state.is_terminal:
            return

        if self._state not in (StrategyState.STOPPED, StrategyState.FAILED):
            await self.stop()

        if self._state == StrategyState.STOPPED:
            self._transition(StrategyState.REMOVED)
        elif self._state == StrategyState.FAILED:
            self._transition(StrategyState.REMOVED)

        self._metrics.shutdown_count += 1
        self._logger.info("Strategy shutdown complete")

    async def reset(self) -> None:
        """Сброс стратегии до начального состояния.

        STOPPED → INSTALLED (сброс метрик и контекста).
        """
        if self._state != StrategyState.STOPPED:
            if self._state.is_active:
                await self.stop()

        self._transition(StrategyState.INSTALLED)

        self._metrics.reset()
        self._context = None
        self._state = StrategyState.LOADED

        self._logger.info("Strategy reset")

    # ── Monitoring ────────────────────────────────────────────────

    async def health(self) -> dict[str, Any]:
        """Проверка состояния стратегии."""
        return {
            "name": self._name,
            "state": self._state.value,
            "instance_id": self._instance_id,
            "uptime_seconds": round(self._metrics.uptime_seconds, 1),
            "analyze_count": self._metrics.analyze_count,
            "signal_count": self._metrics.signal_count,
            "error_count": self._metrics.error_count,
            "last_analyze_ms": self._metrics.last_analyze_ms,
            "last_signal_time": self._metrics.last_signal_time,
            "is_healthy": self.is_healthy,
            "metadata": {
                "version": self._manifest.version if self._manifest else "",
                "category": self._manifest.category.value if self._manifest else "",
                "capabilities": list(self.capabilities),
            },
        }

    async def metrics(self) -> dict[str, Any]:
        """Метрики стратегии для Monitoring."""
        return {
            "name": self._name,
            "state": self._state.value,
            **self._metrics.to_dict(),
        }

    async def info(self) -> StrategyInfo:
        """Публичная мета-информация о стратегии.

        Безопасный вызов: не загружает код, не исполняет analyze().
        Данные из manifest.yaml + runtime-статистика.

        Returns:
            StrategyInfo — полное мета-описание.
        """
        manifest = self._manifest

        profile_dict: dict[str, object] | None = None
        if manifest is not None and manifest.profile is not None:
            profile_dict = manifest.profile.to_dict()

        parameters: dict[str, object] = {}
        schema = manifest.config_schema if manifest else None
        if schema is not None:
            try:
                parameters = schema.default_parameters()
            except Exception:
                pass
        elif manifest is not None:
            # fallback — текущий config
            parameters = dict(self._config.data)

        permissions = [p.value for p in (manifest.permissions if manifest else [Permission.MARKET_DATA, Permission.SIGNALS])]

        return StrategyInfo(
            name=self._name,
            version=manifest.version if manifest else "0.0.0",
            author=manifest.author if manifest else "unknown",
            description=manifest.description if manifest else "",
            category=manifest.category.value if manifest else "custom",
            api_version=manifest.api_version if manifest else "",
            homepage=manifest.homepage if manifest else "",
            repository=manifest.repository if manifest else "",
            license=manifest.license if manifest else "",
            exchange=list(manifest.exchange) if manifest else [],
            markets=list(manifest.markets) if manifest else [],
            timeframes=list(manifest.timeframes) if manifest else [],
            tags=list(manifest.tags) if manifest else [],
            capabilities=list(manifest.capabilities) if manifest else [],
            permissions=permissions,
            profile=profile_dict,
            parameters=parameters,
            state=self._state.value,
            uptime=self._metrics.uptime_seconds,
            analyze_count=self._metrics.analyze_count,
            signal_count=self._metrics.signal_count,
            error_count=self._metrics.error_count,
            error_rate=self._metrics.error_rate,
            avg_analyze_ms=self._metrics.avg_analyze_ms,
            avg_score=self._metrics.avg_score,
            last_signal=self._metrics.last_signal_time,
            config_schema=schema.to_dict() if hasattr(schema, "to_dict") and schema else None,
        )

    # ── Hooks (опциональные) ─────────────────────────────────────

    async def _on_configure(self, ctx: StrategyContext) -> None:
        """Hook: стратегия получила контекст.

        Пользователь может переопределить для:
          - Проверки доступности признаков
          - Загрузки дополнительных настроек
          - Создания вспомогательных объектов

        По умолчанию — пустой.
        """
        pass

    # ── Run (для Engine) ──────────────────────────────────────────

    async def run_analyze(self, ctx: StrategyContext) -> SignalBundle:
        """Выполнить analyze() с замерами времени.

        Вызывается Strategy Engine.
        - Замеряет время выполнения
        - Обрабатывает ошибки
        - Обновляет метрики
        - Логирует результаты

        Args:
            ctx: Контекст для analyze().

        Returns:
            SignalBundle (пустой при ошибке).
        """
        start = time.perf_counter()

        try:
            bundle = await self.analyze(ctx)
        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000
            self._metrics.record_error()
            self._benchmark.record_exception(elapsed, e)
            self._logger.error(
                f"analyze() failed after {elapsed:.0f}ms: {e}",
                exc_info=True,
            )
            return SignalBundle(strategy=self._name)

        elapsed = (time.perf_counter() - start) * 1000
        self._metrics.record_analyze(elapsed, bundle)
        self._benchmark.record_run(
            elapsed_ms=elapsed,
            signal_count=bundle.count,
            is_actionable=len(bundle.actionable) > 0,
        )

        if bundle.signals:
            actionable = len(bundle.actionable)
            self._logger.info(
                f"analyze() → {bundle.count} signals"
                f" ({actionable} actionable) in {elapsed:.0f}ms"
            )
        else:
            self._logger.debug(f"analyze() → no signals in {elapsed:.0f}ms")

        return bundle

    # ── Repr ──────────────────────────────────────────────────────

    def __repr__(self) -> str:
        return (
            f"BaseStrategy({self._name}"
            f" [{self._state.value}]"
            f" sig={self._metrics.signal_count}"
            f")"
        )
