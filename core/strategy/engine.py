"""
StrategyEngine — оркестратор загрузки, запуска и выполнения стратегий.

Pipeline:
  Discovery → Load → Initialize → Warmup → Start → Analyze → Collect

PluginLoader сканирует strategies/*/manifest.yaml.
StrategyEngine управляет lifecycle всех стратегий.

Интеграция:
  - Engine сам регистрируется как IService в ServiceRuntime
  - FeatureAPI/MarketAPI подключаются через DI container
  - Callback on_signal уведомляет Decision Engine (Phase 8)
"""

from __future__ import annotations

import asyncio
import importlib
import inspect
import logging
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

from core.app.phases import Phase
from core.api import CORE_API_VERSION
from core.profiler import profile
from core.strategy.sandbox import SandboxConfig, SandboxContext
from core.strategy.base import BaseStrategy, StrategyMetrics
from core.strategy.context import (
    ExchangeAPI,
    FeatureAPI,
    MarketAPI,
    SessionInfo,
    StateAPI,
    StrategyConfig,
    StrategyContext,
)
from core.strategy.dependency import DependencyResolver, ResolveReport
from core.strategy.descriptor import ManifestLoader, StrategyDescriptor
from core.strategy.discovery import DiscoveryEngine, DiscoverySource, SourceType
from core.strategy.lifecycle import StrategyState
from core.strategy.plugin_registry import PluginRecord, PluginRegistry, PluginRegistryError
from core.strategy.signal import Signal, SignalBundle


# ═══════════════════════════════════════════════════════════════════
#  EngineConfig
# ═══════════════════════════════════════════════════════════════════


@dataclass
class EngineConfig:
    """Настройки StrategyEngine.

    Attributes:
        strategies_dir:     Путь к директории со стратегиями.
        auto_discovery:     Автоматически сканировать strategies_dir при start().
        analyze_on_tick:    Запускать analyze() всех стратегий при каждом tick().
        tick_interval:      Интервал между tick() в секундах (0 = ручной режим).
        warmup_on_start:    Запускать warmup() после initialize().
        on_signal:          Callback при новом сигнале.
        session:            Информация о сессии для всех стратегий.
        default_config:     Настройки по умолчанию для всех стратегий.
    """

    strategies_dir: str = "strategies"
    auto_discovery: bool = True
    analyze_on_tick: bool = True
    tick_interval: float = 0.0
    warmup_on_start: bool = True
    on_signal: Optional[Callable[[Signal], None]] = None
    session: Optional[SessionInfo] = None
    default_config: dict[str, Any] = field(default_factory=dict)
    sandbox: SandboxConfig = field(default_factory=SandboxConfig.default)
    discovery_engine: DiscoveryEngine | None = None
    plugin_registry: PluginRegistry | None = None
    registry_path: str | None = None


# ═══════════════════════════════════════════════════════════════════
#  MockFeatureProvider — встроенные мок-реализации API
# ═══════════════════════════════════════════════════════════════════


class MockFeatureAPI:
    """Встроенная реализация FeatureAPI для тестов.

    Позволяет тестировать стратегии без FeatureEngine.
    Используется по умолчанию — заменяется реальной реализацией
    через DI container на этапе интеграции.

    Пример:
        ctx.features = MockFeatureAPI({
            "ema": {"BTC/USDT|20": 45000.0},
            "rsi": {"BTC/USDT": 55.0},
            "candles": {"BTC/USDT": [...]},
        })
    """

    def __init__(self, data: dict[str, dict[str, Any]] | None = None) -> None:
        self._data: dict[str, dict[str, Any]] = data or {}
        self._latest: dict[str, dict[str, Any]] = {}

    def _key(self, name: str, symbol: str | None, **params: Any) -> str:
        parts = [name]
        if symbol:
            parts.append(symbol)
        for k, v in sorted(params.items()):
            parts.append(f"{k}={v}")
        return "|".join(parts)

    async def init(self, data: dict[str, dict[str, Any]]) -> None:
        """Загрузить данные (для тестов)."""
        self._data = data

    async def get(
        self,
        name: str,
        symbol: str | None = None,
        **params: Any,
    ) -> Any:
        key = self._key(name, symbol, **params)
        if key in self._data:
            return self._data[key]
        if name in self._data:
            return self._data[name]
        return None

    def latest(self, name: str, symbol: str | None = None) -> Any:
        key = self._key(name, symbol)
        if key in self._latest:
            return self._latest[key]
        return None

    async def get_candles(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        key = f"candles|{symbol}|timeframe={timeframe}"
        if key in self._data:
            return self._data[key][:limit]
        return []

    async def has(self, name: str) -> bool:
        return name in self._data or any(
            k.startswith(f"{name}|") for k in self._data
        )


class MockMarketAPI:
    """Встроенная реализация MarketAPI."""

    def __init__(self) -> None:
        self._prices: dict[str, float] = {}
        self._tickers: dict[str, dict] = {}
        self._volumes: dict[str, float] = {}
        self._volatilities: dict[str, float] = {}

    async def init(
        self,
        prices: dict[str, float] | None = None,
        tickers: dict[str, dict] | None = None,
    ) -> None:
        if prices:
            self._prices.update(prices)
        if tickers:
            self._tickers.update(tickers)

    async def price(self, symbol: str) -> float | None:
        return self._prices.get(symbol)

    async def ticker(self, symbol: str) -> dict[str, Any] | None:
        return self._tickers.get(symbol)

    def volume(self, symbol: str) -> float | None:
        return self._volumes.get(symbol)

    def volatility(self, symbol: str) -> float | None:
        return self._volatilities.get(symbol)


class MockStateAPI:
    """Встроенная реализация StateAPI."""

    def __init__(self) -> None:
        self._state: dict[str, Any] = {}
        self._start_time = time.time()

    def get(self, key: str, default: Any = None) -> Any:
        return self._state.get(key, default)

    def set(self, key: str, value: Any) -> None:
        self._state[key] = value

    def increment(self, key: str, delta: int = 1) -> int:
        new = self._state.get(key, 0) + delta
        self._state[key] = new
        return new

    def keys(self) -> list[str]:
        return list(self._state.keys())

    def reset(self) -> None:
        self._state.clear()

    @property
    def uptime(self) -> float:
        return time.time() - self._start_time

    @property
    def signal_count(self) -> int:
        return self._state.get("signal_count", 0)


class MockExchangeAPI:
    """Встроенная реализация ExchangeAPI."""

    def __init__(self, name: str = "mock", mode: str = "paper") -> None:
        self._name = name
        self._mode = mode
        self._limits: dict[str, dict] = {}
        self._trading: dict[str, bool] = {}

    async def name(self) -> str:
        return self._name

    async def is_trading(self, symbol: str) -> bool:
        return self._trading.get(symbol, True)

    def limits(self, symbol: str) -> dict[str, Any]:
        return self._limits.get(symbol, {})

    @property
    def mode(self) -> str:
        return self._mode


from core.strategy.loader import PluginInfo, PluginLoader


# ═══════════════════════════════════════════════════════════════════
#  StrategyEngine — оркестратор
# ═══════════════════════════════════════════════════════════════════


class StrategyEngine:
    """Оркестратор стратегий.

    Управляет полным lifecycle всех загруженных стратегий.

    Основные методы:
        load_all()    — обнаружить и загрузить все стратегии.
        start_all()   — инициализировать, прогреть и запустить.
        analyze_all() — выполнить analyze() на всех стратегиях.
        stop_all()    — остановить и выгрузить.
        tick()        — один цикл: analyze_all() с паузой.

    Полностью совместим с IService для ServiceRuntime.
    """

    # ── IService interface ──
    name: str = "StrategyEngine"
    phase: Phase = Phase.STRATEGY

    def __init__(
        self,
        config: EngineConfig | None = None,
        plugin_loader: PluginLoader | None = None,
        feature_api: FeatureAPI | None = None,
        market_api: MarketAPI | None = None,
        exchange_api: ExchangeAPI | None = None,
    ) -> None:
        self._config = config or EngineConfig()
        self._loader = plugin_loader or PluginLoader(self._config.strategies_dir)
        self._logger = logging.getLogger("strategy.engine")

        # ── API providers ──
        self._feature_api: FeatureAPI = feature_api or MockFeatureAPI()
        self._market_api: MarketAPI = market_api or MockMarketAPI()
        self._exchange_api: ExchangeAPI = exchange_api or MockExchangeAPI()

        # ── Strategies ──
        self._strategies: dict[str, BaseStrategy] = {}
        self._plugins: list[PluginInfo] = []

        # ── State ──
        self._started = False

        # ── Sandbox ──
        self._sandbox_ctx = SandboxContext(self._config.sandbox)

        # ── Phase 6: Discovery Engine + Plugin Registry ──
        if self._config.discovery_engine is not None:
            self._discovery = self._config.discovery_engine
        else:
            self._discovery = DiscoveryEngine()
            self._discovery.add_source(
                DiscoverySource(
                    type=SourceType.LOCAL,
                    path=self._config.strategies_dir,
                    label="strategies",
                    priority=10,
                )
            )

        if self._config.plugin_registry is not None:
            self._registry = self._config.plugin_registry
        else:
            self._registry = PluginRegistry(
                registry_path=self._config.registry_path
            )

    # ── Properties ──

    @property
    def strategies(self) -> dict[str, BaseStrategy]:
        """Загруженные стратегии (name → instance)."""
        return dict(self._strategies)

    @property
    def count(self) -> int:
        return len(self._strategies)

    @property
    def is_running(self) -> bool:
        return self._started

    def get(self, name: str) -> BaseStrategy | None:
        return self._strategies.get(name)

    # ── Pipeline: Discovery (old) ─────────────────────────────────

    async def discover(self) -> list[PluginInfo]:
        """Обнаружить все стратегии в filesystem.

        Returns:
            Список обнаруженных плагинов.
        """
        self._plugins = await self._loader.discover()
        return self._plugins

    # ── Phase 6: Discovery Engine + Plugin Registry ─────────────────

    @property
    def discovery_engine(self) -> DiscoveryEngine:
        """Discovery Engine (Phase 6)."""
        return self._discovery

    @property
    def plugin_registry(self) -> PluginRegistry:
        """Plugin Registry (Phase 6)."""
        return self._registry

    async def discover_plugins(self) -> list[PluginRecord]:
        """Обнаружить плагины через Discovery Engine и зарегистрировать.

        Returns:
            Список зарегистрированных PluginRecord.
        """
        discovered = await self._discovery.discover()
        records = []
        for plugin in discovered:
            record = self._registry.register(plugin)
            records.append(record)
        return records

    def enable_plugin(self, name: str) -> PluginRecord:
        """Включить плагин (enable).

        Args:
            name: Имя плагина.

        Returns:
            PluginRecord.
        """
        return self._registry.set_enabled(name, True)

    def disable_plugin(self, name: str, reason: str | None = None) -> PluginRecord:
        """Отключить плагин (disable).

        Args:
            name: Имя плагина.
            reason: Причина отключения.

        Returns:
            PluginRecord.
        """
        return self._registry.set_enabled(name, False, reason=reason)

    def list_plugins(self) -> list[PluginRecord]:
        """Список всех зарегистрированных плагинов."""
        return self._registry.list()

    def list_enabled(self) -> list[PluginRecord]:
        """Список включённых плагинов."""
        return self._registry.get_enabled_plugins()

    def list_disabled(self) -> list[PluginRecord]:
        """Список отключённых плагинов."""
        return self._registry.get_disabled_plugins()

    def get_plugin(self, name: str) -> PluginRecord | None:
        """Получить запись плагина."""
        return self._registry.get(name)

    def save_registry(self) -> None:
        """Сохранить registry.json."""
        self._registry.save()

    # ── Dependency Resolution ──

    @property
    def dependency_resolver(self) -> DependencyResolver:
        """DependencyResolver для стратегий."""
        return self._registry.dependency_resolver

    def resolve_dependencies(
        self,
        check_versions: bool = True,
        strict: bool = False,
    ) -> ResolveReport:
        """Разрешить зависимости для всех зарегистрированных плагинов.

        Args:
            check_versions: Проверять версионные ограничения.
            strict:         Опциональные missing deps как ошибка.

        Returns:
            ResolveReport.
        """
        return self._registry.resolve_dependencies(
            check_versions=check_versions,
            strict=strict,
        )

    def resolve_plugin(
        self,
        name: str,
        check_versions: bool = True,
        strict: bool = False,
    ) -> ResolveReport:
        """Разрешить зависимости для одного плагина.

        Args:
            name:           Имя плагина.
            check_versions: Проверять версионные ограничения.
            strict:         Опциональные missing deps как ошибка.

        Returns:
            ResolveReport.
        """
        return self._registry.resolve_plugin(
            name,
            check_versions=check_versions,
            strict=strict,
        )

    def startup_order(self) -> list[str]:
        """Топологический порядок запуска плагинов.

        Returns:
            Список имён плагинов в порядке запуска.

        Raises:
            PluginRegistryError: Если есть циклические зависимости.
        """
        return self._registry.startup_order()

    def check_dependencies(self, name: str) -> tuple[bool, list[str]]:
        """Проверить, удовлетворены ли зависимости плагина.

        Args:
            name: Имя плагина.

        Returns:
            (ok, reasons).
        """
        return self._registry.check_dependencies(name)

    # ── Pipeline: Load ─────────────────────────────────────────────

    async def load_all(self) -> dict[str, BaseStrategy]:
        """Загрузить все обнаруженные стратегии.

        Шаги:
          1. discover() — найти все manifest.yaml
          2. Для каждого: импортировать модуль, создать экземпляр

        Returns:
            dict[name → BaseStrategy]
        """
        if not self._plugins:
            await self.discover()

        for info in self._plugins:
            if info.descriptor.name in self._strategies:
                self._logger.warning(
                    f"Duplicate strategy: {info.descriptor.name}, skipping"
                )
                continue

            try:
                strategy_class = self._loader.import_strategy(info)
                strategy = strategy_class(
                    name=info.descriptor.name,
                    manifest_path=info.manifest_path,
                )
                # Apply default config
                if self._config.default_config:
                    cfg = StrategyConfig.from_dict(
                        self._config.default_config
                    )
                    strategy._config = cfg  # noqa: SLF001

                self._strategies[info.descriptor.name] = strategy
                self._logger.info(
                    f"Loaded: {info.descriptor.name} v{info.descriptor.version}"
                )
            except Exception as e:
                self._logger.error(
                    f"Failed to load {info.descriptor.name}: {e}"
                )

        return self._strategies

    # ── Pipeline: Initialize ──────────────────────────────────────

    def _build_context(self, strategy: BaseStrategy) -> StrategyContext:
        """Построить контекст для стратегии.

        Собирает StrategyContext из:
          - manifest (descriptor)
          - config стратегии
          - mock API (Feature, Market, State, Exchange)
          - SessionInfo
        """
        manifest = strategy.manifest
        if manifest is None:
            try:
                manifest = ManifestLoader.from_dict({
                    "name": strategy.name,
                })
            except Exception:
                from core.strategy.descriptor import StrategyCategory

                manifest = StrategyDescriptor(
                    name=strategy.name,
                    version="0.0",
                    category=StrategyCategory.CUSTOM,
                    capabilities=[],
                )

        state_api = MockStateAPI()
        ctx = StrategyContext(
            descriptor=manifest,
            config=strategy._config,  # noqa: SLF001
            session=self._config.session or SessionInfo(
                symbols=manifest.symbols if hasattr(manifest, "symbols") else [],
            ),
            features=self._feature_api,
            market=self._market_api,
            state=state_api,
            exchange=self._exchange_api,
        )
        return ctx

    async def initialize_all(self) -> None:
        """Инициализировать все загруженные стратегии.

        Для каждой стратегии:
          1. Строит StrategyContext
          2. Вызывает initialize(ctx)
          3. Если warmup_on_start — вызывает warmup()
        """
        for name, strategy in self._strategies.items():
            if strategy.state not in (
                StrategyState.DISCOVERED.value,
                StrategyState.INSTALLED.value,
            ):
                continue

            try:
                ctx = self._build_context(strategy)
                await strategy.initialize(ctx)
                self._logger.info(f"Initialized: {name}")

                if self._config.warmup_on_start:
                    await strategy.warmup()
            except Exception as e:
                self._logger.error(
                    f"Failed to initialize {name}: {e}",
                    exc_info=True,
                )

    # ── Pipeline: Start ──────────────────────────────────────────

    async def start_all(self) -> None:
        """Запустить все инициализированные стратегии.

        Вызывает start() на каждой стратегии.
        """
        for name, strategy in self._strategies.items():
            if strategy.state != StrategyState.INITIALIZED.value:
                continue
            try:
                await strategy.start()
                self._logger.info(f"Started: {name}")
            except Exception as e:
                self._logger.error(f"Failed to start {name}: {e}")

        self._started = True
        self._logger.info(
            f"StrategyEngine: {self.count} strategies running"
        )

    # ── Pipeline: Analyze ────────────────────────────────────────

    @profile("strategy_engine.analyze_all")
    async def analyze_all(self) -> dict[str, SignalBundle]:
        """Выполнить analyze() на всех запущенных стратегиях.

        Returns:
            dict[strategy_name → SignalBundle]
        """
        results: dict[str, SignalBundle] = {}

        for name, strategy in self._strategies.items():
            if strategy.state != StrategyState.RUNNING.value:
                continue

            ctx = strategy.context
            if ctx is None:
                # Build context if not yet built
                ctx = self._build_context(strategy)
                # But don't save it — strategy should already have context

            # Запускаем под sandbox (если включён)
            strategy_dir = (
                str(Path(self._config.strategies_dir) / name)
                if self._config.strategies_dir
                else None
            )
            sandbox = self._sandbox_ctx.for_strategy(strategy_dir or name)
            sandbox_result, bundle = await sandbox.run(
                strategy.run_analyze(ctx),
                timeout=self._config.sandbox.analyze_timeout if self._config else None,
            )

            if sandbox_result.success and bundle is not None:

                # Callback для сигналов
                if bundle.signals and self._config.on_signal:
                    for signal in bundle.signals:
                        try:
                            self._config.on_signal(signal)
                        except Exception as e:
                            self._logger.error(
                                f"on_signal callback failed: {e}"
                            )
            else:
                if sandbox_result.timed_out:
                    self._logger.error(
                        f"analyze_all {name} timed out after "
                        f"{self._config.sandbox.analyze_timeout}s"
                    )
                elif sandbox_result.violations:
                    self._logger.error(
                        f"analyze_all {name} sandbox violations: "
                        f"{'; '.join(sandbox_result.violations)}"
                    )
                else:
                    self._logger.error(
                        f"analyze_all {name} failed: {sandbox_result.error}"
                    )
                bundle = SignalBundle(strategy=name)

            results[name] = bundle

        return results

    async def analyze_one(self, name: str) -> Optional[SignalBundle]:
        """Выполнить analyze() на одной стратегии.

        Args:
            name: Имя стратегии.

        Returns:
            SignalBundle или None если стратегия не найдена.
        """
        strategy = self._strategies.get(name)
        if strategy is None:
            self._logger.warning(f"Strategy not found: {name}")
            return None

        if strategy.state != StrategyState.RUNNING.value:
            self._logger.warning(f"Strategy not running: {name}")
            return SignalBundle(strategy=name)

        ctx = strategy.context or self._build_context(strategy)
        return await strategy.run_analyze(ctx)

    # ── Pipeline: Stop ───────────────────────────────────────────

    async def stop_all(self) -> None:
        """Остановить все стратегии.

        Обратный порядок (LIFO — стопорим последние загруженные первыми).
        """
        for name in reversed(list(self._strategies.keys())):
            strategy = self._strategies[name]
            try:
                await strategy.stop()
                self._logger.info(f"Stopped: {name}")
            except Exception as e:
                self._logger.error(f"Failed to stop {name}: {e}")

        self._started = False
        self._logger.info("All strategies stopped")

    async def shutdown_all(self) -> None:
        """Полное завершение всех стратегий (shutdown + выгрузка)."""
        for name in reversed(list(self._strategies.keys())):
            strategy = self._strategies[name]
            try:
                await strategy.shutdown()
            except Exception as e:
                self._logger.error(f"Failed to shutdown {name}: {e}")

        self._strategies.clear()
        self._plugins.clear()
        self._started = False
        self._logger.info("All strategies shutdown complete")

    # ── Pipeline: Tick ───────────────────────────────────────────

    async def tick(self) -> dict[str, SignalBundle]:
        """Один цикл выполнения.

        Если analyze_on_tick = True — запускает analyze_all().
        Если tick_interval > 0 — делает паузу.

        Returns:
            Результаты analyze_all().
        """
        if not self._config.analyze_on_tick:
            return {}

        results = await self.analyze_all()

        if self._config.tick_interval > 0:
            await asyncio.sleep(self._config.tick_interval)

        return results

    # ── IService compatible lifecycle ────────────────────────────

    async def health(self) -> dict[str, Any]:
        """Проверка состояния Engine (IService совместимость)."""
        strategy_states = {
            name: strat.state for name, strat in self._strategies.items()
        }

        # Собираем метрики от каждой стратегии
        total_signals = sum(
            strat._metrics.signal_count  # noqa: SLF001
            for strat in self._strategies.values()
        )
        total_errors = sum(
            strat._metrics.error_count  # noqa: SLF001
            for strat in self._strategies.values()
        )
        running = sum(
            1 for s in self._strategies.values()
            if s.state == StrategyState.RUNNING.value
        )

        return {
            "name": self.name,
            "state": "running" if self._started else "stopped",
            "strategy_count": self.count,
            "running": running,
            "total_signals": total_signals,
            "total_errors": total_errors,
            "strategies": strategy_states,
        }

    async def metrics(self) -> dict[str, Any]:
        """Метрики Engine."""
        per_strategy = {
            name: await strat.metrics()
            for name, strat in self._strategies.items()
        }

        total_signals = sum(
            m.get("signal_count", 0) for m in per_strategy.values()
        )
        total_errors = sum(
            m.get("error_count", 0) for m in per_strategy.values()
        )

        return {
            "strategy_count": self.count,
            "total_signals": total_signals,
            "total_errors": total_errors,
            "strategies": per_strategy,
        }

    # ── Shortcut: full pipeline ──────────────────────────────────

    async def run_pipeline(
        self,
        strategies_dir: str | None = None,
    ) -> None:
        """Полный пайплайн: Load → Initialize → Start.

        Args:
            strategies_dir: Опциональный путь к стратегиям (переопределяет config).
        """
        if strategies_dir:
            self._config.strategies_dir = strategies_dir
            self._loader = PluginLoader(strategies_dir)

        await self.load_all()
        await self.initialize_all()
        await self.start_all()
