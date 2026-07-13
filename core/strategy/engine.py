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

        # ── Registry Service (Phase 6: Discovery + PluginRegistry) ──
        self._registry_service = self._build_registry()
        self._discovery = self._registry_service.discovery_engine
        self._registry = self._registry_service.plugin_registry

        # ── Runner ──
        self._runner = self._build_runner()

        # ── Scheduler ──
        self._scheduler = self._build_scheduler()

        # ── Lifecycle ──
        self._lifecycle = self._build_lifecycle()

    def _build_lifecycle(self) -> Any:
        """Создать StrategyLifecycle."""
        from core.strategy.lifecycle_ext import StrategyLifecycle as Lifecycle

        return Lifecycle(
            strategies=self._strategies,
            plugins=self._plugins,
            loader=self._loader,
            config=self._config,
            build_context=self._build_context,
            set_started=lambda v: setattr(self, '_started', v),
            logger_override=self._logger,
        )

    def _build_scheduler(self) -> Any:
        """Создать StrategyScheduler."""
        from core.strategy.scheduler import StrategyScheduler as Scheduler

        return Scheduler(
            analyze_fn=self.analyze_all,
            analyze_on_tick=self._config.analyze_on_tick,
            tick_interval=self._config.tick_interval,
            logger_override=self._logger,
        )

    def _build_runner(self) -> Any:
        """Создать StrategyRunner."""
        from core.strategy.runner import StrategyRunner as Runner

        return Runner(
            strategies=self._strategies,
            sandbox_ctx=self._sandbox_ctx,
            sandbox_config=self._config.sandbox,
            strategies_dir=self._config.strategies_dir,
            build_context=self._build_context,
            logger_override=self._logger,
        )

    def _build_registry(self) -> RegistryService:
        """Создать StrategyRegistry из конфига."""
        from core.strategy.registry import StrategyRegistry as RegistryService

        return RegistryService(
            discovery=self._config.discovery_engine,
            plugin_registry=self._config.plugin_registry,
            strategies_dir=self._config.strategies_dir,
            registry_path=self._config.registry_path,
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

    # ── Discovery (old) ──

    async def discover(self) -> list[PluginInfo]:
        """Обнаружить все стратегии в filesystem.

        Returns:
            Список обнаруженных плагинов.
        """
        self._plugins = await self._loader.discover()
        return self._plugins

    # ── Registry delegation ──

    @property
    def discovery_engine(self) -> Any:
        """Discovery Engine (Phase 6)."""
        return self._registry_service.discovery_engine

    @property
    def plugin_registry(self) -> Any:
        """Plugin Registry (Phase 6)."""
        return self._registry_service.plugin_registry

    async def discover_plugins(self) -> list[Any]:
        """Обнаружить плагины через Discovery Engine и зарегистрировать."""
        return await self._registry_service.discover_plugins()

    def enable_plugin(self, name: str) -> Any:
        return self._registry_service.enable_plugin(name)

    def disable_plugin(self, name: str, reason: str | None = None) -> Any:
        return self._registry_service.disable_plugin(name, reason=reason)

    def list_plugins(self) -> list[Any]:
        return self._registry_service.list_plugins()

    def list_enabled(self) -> list[Any]:
        return self._registry_service.list_enabled()

    def list_disabled(self) -> list[Any]:
        return self._registry_service.list_disabled()

    def get_plugin(self, name: str) -> Any:
        return self._registry_service.get_plugin(name)

    def save_registry(self) -> None:
        self._registry_service.save_registry()

    @property
    def dependency_resolver(self) -> Any:
        return self._registry_service.dependency_resolver

    def resolve_dependencies(
        self,
        check_versions: bool = True,
        strict: bool = False,
    ) -> Any:
        return self._registry_service.resolve_dependencies(
            check_versions=check_versions, strict=strict
        )

    def resolve_plugin(self, name: str, check_versions: bool = True, strict: bool = False) -> Any:
        return self._registry_service.resolve_plugin(
            name, check_versions=check_versions, strict=strict
        )

    def startup_order(self) -> list[str]:
        return self._registry_service.startup_order()

    def check_dependencies(self, name: str) -> tuple[bool, list[str]]:
        return self._registry_service.check_dependencies(name)

    # ── Pipeline: Load ─────────────────────────────────────────────

    async def load_all(self) -> dict[str, BaseStrategy]:
        """Загрузить все обнаруженные стратегии.

        Делегирует StrategyLifecycle.
        """
        return await self._lifecycle.load_all()

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

        Делегирует StrategyLifecycle.
        """
        await self._lifecycle.initialize_all()

    # ── Pipeline: Start ──────────────────────────────────────────

    async def start_all(self) -> None:
        """Запустить все инициализированные стратегии.

        Делегирует StrategyLifecycle.
        """
        await self._lifecycle.start_all()

    # ── Pipeline: Analyze ────────────────────────────────────────

    @profile("engine.analyze_all")
    async def analyze_all(self) -> dict[str, SignalBundle]:
        """Выполнить analyze() на всех запущенных стратегиях."""
        return await self._runner.analyze_all(
            on_signal=self._config.on_signal,
        )

    async def analyze_one(self, name: str) -> Optional[SignalBundle]:
        """Выполнить analyze() на одной стратегии."""
        return await self._runner.analyze_one(name)

    # ── Pipeline: Stop ───────────────────────────────────────────

    async def stop_all(self) -> None:
        """Остановить все стратегии.

        Делегирует StrategyLifecycle.
        """
        await self._lifecycle.stop_all()

    async def shutdown_all(self) -> None:
        """Полное завершение всех стратегий (shutdown + выгрузка).

        Делегирует StrategyLifecycle.
        """
        await self._lifecycle.shutdown_all()

    # ── Pipeline: Tick ───────────────────────────────────────────

    async def tick(self) -> dict[str, SignalBundle]:
        """Один цикл выполнения.

        Делегирует StrategyScheduler.
        """
        return await self._scheduler.tick()

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

        Делегирует StrategyLifecycle.
        """
        await self._lifecycle.run_pipeline(strategies_dir=strategies_dir)
