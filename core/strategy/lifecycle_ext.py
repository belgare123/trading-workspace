"""Strategy Lifecycle — загрузка, инициализация, старт, остановка стратегий.

Отвечает за pipeline:
  load_all() → initialize_all() → start_all()
  stop_all() → shutdown_all()

Не содержит _build_context — получает его как callback от Engine.

Пример:
    lifecycle = StrategyLifecycle(
        strategies, plugins, loader, config,
        build_context, set_started, ...
    )
    await lifecycle.load_all()
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Awaitable, Callable

from core.strategy.base import BaseStrategy
from core.strategy.context import (
    SessionInfo,
    StrategyConfig,
    StrategyContext,
)
from core.strategy.lifecycle import StrategyState
from core.strategy.loader import PluginInfo, PluginLoader


logger = logging.getLogger(__name__)


class StrategyLifecycle:
    """Управление lifecycle стратегий.

    Responsibilities:
        - load_all()       — обнаружение + импорт + создание экземпляров
        - initialize_all() — построение контекста + инициализация + warmup
        - start_all()      — запуск стратегий
        - stop_all()       — остановка
        - shutdown_all()   — полное завершение + выгрузка
        - run_pipeline()   — полный пайплайн

    Composition:
        self._strategies    — ссылка на dict[name → BaseStrategy] (shared с Engine)
        self._plugins       — ссылка на список PluginInfo (shared с Engine)
        self._loader        — PluginLoader
        self._config        — EngineConfig (через Any для избежания circular imports)
        self._build_context — фабрика StrategyContext (из Engine)
        self._set_started   — колбэк для обновления флага _started в Engine
    """

    def __init__(
        self,
        strategies: dict[str, BaseStrategy],
        plugins: list[PluginInfo],
        loader: PluginLoader,
        config: Any,
        build_context: Callable[[BaseStrategy], StrategyContext],
        set_started: Callable[[bool], None],
        discover_fn: Callable[[], Awaitable[list[Any]]] | None = None,
        logger_override: logging.Logger | None = None,
    ) -> None:
        self._strategies = strategies
        self._plugins = plugins
        self._loader = loader
        self._config = config
        self._build_context = build_context
        self._set_started = set_started
        self._discover_fn = discover_fn
        self._logger = logger_override or logging.getLogger("strategy.lifecycle")

    # ── Load ─────────────────────────────────────────────────────

    async def load_all(self) -> dict[str, BaseStrategy]:
        """Загрузить все обнаруженные стратегии.

        Шаги:
          1. discover() — через единый Discovery Engine (или PluginLoader)
          2. Для каждого: импортировать модуль, создать экземпляр

        Returns:
            dict[name → BaseStrategy]
        """
        plugins = self._plugins
        if not plugins:
            if self._discover_fn:
                records = await self._discover_fn()
                self._plugins.clear()
                self._plugins.extend(
                    PluginInfo.from_plugin_record(r) for r in records
                )
            else:
                plugins = await self._loader.discover()
                self._plugins.clear()
                self._plugins.extend(plugins)
            plugins = self._plugins

        for info in plugins:
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

    # ── Initialize ───────────────────────────────────────────────

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

    # ── Start ────────────────────────────────────────────────────

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

        self._set_started(True)
        self._logger.info(
            f"StrategyEngine: {len(self._strategies)} strategies running"
        )

    # ── Stop ─────────────────────────────────────────────────────

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

        self._set_started(False)
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
        self._set_started(False)
        self._logger.info("All strategies shutdown complete")

    # ── Full pipeline ────────────────────────────────────────────

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
