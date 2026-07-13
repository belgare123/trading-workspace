"""
StrategyEngine — тонкий фасад над подсистемами декомпозиции.

Управляет полным lifecycle стратегий: Discovery → Load → Initialize → Start → Analyze → Stop.

Делегирует:
  - PluginLoader           — импорт Python-модулей
  - StrategyRegistry       — discovery, регистрация, enable/disable
  - StrategyRunner         — analyze_all / analyze_one с sandbox
  - StrategyScheduler      — tick() / interval
  - StrategyLifecycle      — load / init / start / stop / shutdown

Использование:
    engine = StrategyEngine(config)
    await engine.load_all()
    await engine.initialize_all()
    await engine.start_all()
    results = await engine.analyze_all()
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional

from core.app.phases import Phase
from core.strategy.base import BaseStrategy
from core.strategy.config import EngineConfig
from core.strategy.context import (
    ExchangeAPI,
    FeatureAPI,
    MarketAPI,
    SessionInfo,
    StrategyContext,
)
from core.strategy.lifecycle import StrategyState
from core.strategy.loader import PluginInfo, PluginLoader
from core.strategy.mocks import (
    MockExchangeAPI,
    MockFeatureAPI,
    MockMarketAPI,
    MockStateAPI,
)
from core.strategy.sandbox import SandboxContext
from core.strategy.signal import Signal, SignalBundle

from core.profiler import profile


class StrategyEngine:
    """Оркестратор стратегий — тонкий фасад.

    Полностью совместим с IService для ServiceRuntime.
    Все реализации делегируются компонентам ниже.
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

        # API providers
        self._feature_api: FeatureAPI = feature_api or MockFeatureAPI()
        self._market_api: MarketAPI = market_api or MockMarketAPI()
        self._exchange_api: ExchangeAPI = exchange_api or MockExchangeAPI()

        # Mutable state
        self._strategies: dict[str, BaseStrategy] = {}
        self._plugins: list[PluginInfo] = []
        self._started = False
        self._sandbox_ctx = SandboxContext(self._config.sandbox)

        # Delegate components
        from core.strategy.registry import StrategyRegistry
        from core.strategy.runner import StrategyRunner
        from core.strategy.scheduler import StrategyScheduler
        from core.strategy.lifecycle_ext import StrategyLifecycle

        self._registry_service = StrategyRegistry(
            discovery=self._config.discovery_engine,
            plugin_registry=self._config.plugin_registry,
            strategies_dir=self._config.strategies_dir,
            registry_path=self._config.registry_path,
        )
        self._discovery = self._registry_service.discovery_engine
        self._registry = self._registry_service.plugin_registry

        self._runner = StrategyRunner(
            strategies=self._strategies,
            sandbox_ctx=self._sandbox_ctx,
            sandbox_config=self._config.sandbox,
            strategies_dir=self._config.strategies_dir,
            build_context=self._build_context,
            logger_override=self._logger,
        )
        self._scheduler = StrategyScheduler(
            analyze_fn=self.analyze_all,
            analyze_on_tick=self._config.analyze_on_tick,
            tick_interval=self._config.tick_interval,
            logger_override=self._logger,
        )
        self._lifecycle = StrategyLifecycle(
            strategies=self._strategies,
            plugins=self._plugins,
            loader=self._loader,
            config=self._config,
            build_context=self._build_context,
            set_started=lambda v: setattr(self, '_started', v),
            discover_fn=self._registry_service.discover_plugins,
            logger_override=self._logger,
        )

    # ── Properties ──

    @property
    def strategies(self) -> dict[str, BaseStrategy]:
        return dict(self._strategies)

    @property
    def count(self) -> int:
        return len(self._strategies)

    @property
    def is_running(self) -> bool:
        return self._started

    def get(self, name: str) -> BaseStrategy | None:
        return self._strategies.get(name)

    # ── Discovery ──

    async def discover(self) -> list[PluginInfo]:
        records = await self._registry_service.discover_plugins()
        self._plugins = [PluginInfo.from_plugin_record(r) for r in records]
        return self._plugins

    # ── Registry delegation ──

    @property
    def discovery_engine(self) -> Any:
        return self._registry_service.discovery_engine

    @property
    def plugin_registry(self) -> Any:
        return self._registry_service.plugin_registry

    async def discover_plugins(self) -> list[Any]:
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

    def resolve_dependencies(self, check_versions: bool = True, strict: bool = False) -> Any:
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

    # ── Pipeline: Load / Init / Start ──

    async def load_all(self) -> dict[str, BaseStrategy]:
        return await self._lifecycle.load_all()

    def _build_context(self, strategy: BaseStrategy) -> StrategyContext:
        """Построить StrategyContext для стратегии (фабрика)."""
        from core.strategy.descriptor import ManifestLoader, StrategyDescriptor, StrategyCategory

        manifest = strategy.manifest
        if manifest is None:
            try:
                manifest = ManifestLoader.from_dict({"name": strategy.name})
            except Exception:
                manifest = StrategyDescriptor(
                    name=strategy.name,
                    version="0.0",
                    category=StrategyCategory.CUSTOM,
                    capabilities=[],
                )

        ctx = StrategyContext(
            descriptor=manifest,
            config=strategy._config,  # noqa: SLF001
            session=self._config.session or SessionInfo(
                symbols=manifest.symbols if hasattr(manifest, "symbols") else [],
            ),
            features=self._feature_api,
            market=self._market_api,
            state=MockStateAPI(),
            exchange=self._exchange_api,
        )
        return ctx

    async def initialize_all(self) -> None:
        await self._lifecycle.initialize_all()

    async def start_all(self) -> None:
        await self._lifecycle.start_all()

    # ── Pipeline: Analyze ──

    @profile("engine.analyze_all")
    async def analyze_all(self) -> dict[str, SignalBundle]:
        return await self._runner.analyze_all(on_signal=self._config.on_signal)

    async def analyze_one(self, name: str) -> Optional[SignalBundle]:
        return await self._runner.analyze_one(name)

    # ── Pipeline: Stop ──

    async def stop_all(self) -> None:
        await self._lifecycle.stop_all()

    async def shutdown_all(self) -> None:
        await self._lifecycle.shutdown_all()

    # ── Pipeline: Tick ──

    async def tick(self) -> dict[str, SignalBundle]:
        return await self._scheduler.tick()

    # ── IService: health / metrics ──

    async def health(self) -> dict[str, Any]:
        strategy_states = {
            name: strat.state for name, strat in self._strategies.items()
        }
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

    # ── Full pipeline ──

    async def run_pipeline(self, strategies_dir: str | None = None) -> None:
        await self._lifecycle.run_pipeline(strategies_dir=strategies_dir)
