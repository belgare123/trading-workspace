"""Strategy Runner — выполнение analyze() стратегий с sandbox и таймаутами.

Оборачивает вызовы стратегий в SandboxContext для изоляции,
предоставляет analyze_all() и analyze_one().

Пример:
    runner = StrategyRunner(config, strategies, sandbox_ctx, build_context)
    results = await runner.analyze_all()
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Callable, Optional

from core.profiler import profile
from core.strategy.base import BaseStrategy
from core.strategy.context import StrategyContext
from core.strategy.lifecycle import StrategyState
from core.strategy.sandbox import SandboxConfig, SandboxContext
from core.strategy.signal import Signal, SignalBundle


logger = logging.getLogger(__name__)


class StrategyRunner:
    """Выполнение стратегий с песочницей и обработкой ошибок.

    Responsibilities:
        - analyze_all()  — iterate all running strategies
        - analyze_one()  — run a single strategy by name
        - sandbox        — изоляция каждого вызова
        - timeout        — контроль времени выполнения

    Composition:
        self._strategies   — ссылка на dict[name → BaseStrategy] из Engine
        self._sandbox_ctx  — контекст песочницы
        self._build_context — фабрика StrategyContext
        self._on_signal    — callback при новых сигналах
    """

    def __init__(
        self,
        strategies: dict[str, BaseStrategy],
        sandbox_ctx: SandboxContext,
        sandbox_config: SandboxConfig,
        strategies_dir: str,
        build_context: Callable[[BaseStrategy], StrategyContext],
        logger_override: logging.Logger | None = None,
    ) -> None:
        self._strategies = strategies
        self._sandbox_ctx = sandbox_ctx
        self._sandbox_config = sandbox_config
        self._strategies_dir = strategies_dir
        self._build_context = build_context
        self._logger = logger_override or logging.getLogger("strategy.runner")

    @profile("strategy_engine.analyze_all")
    async def analyze_all(
        self,
        on_signal: Callable[[Signal], None] | None = None,
    ) -> dict[str, SignalBundle]:
        """Выполнить analyze() на всех запущенных стратегиях.

        Args:
            on_signal: Опциональный callback при новых сигналах (читается
                       динамически при каждом вызове).
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

            # Запускаем под sandbox (если включён)
            strategy_dir = (
                str(Path(self._strategies_dir) / name)
                if self._strategies_dir
                else None
            )
            sandbox = self._sandbox_ctx.for_strategy(strategy_dir or name)
            sandbox_result, bundle = await sandbox.run(
                strategy.run_analyze(ctx),
                timeout=self._sandbox_config.analyze_timeout if self._sandbox_config else None,
            )

            if sandbox_result.success and bundle is not None:

                # Callback для сигналов
                if bundle.signals and on_signal:
                    for signal in bundle.signals:
                        try:
                            on_signal(signal)
                        except Exception as e:
                            self._logger.error(
                                f"on_signal callback failed: {e}"
                            )
            else:
                if sandbox_result.timed_out:
                    self._logger.error(
                        f"analyze_all {name} timed out after "
                        f"{self._sandbox_config.analyze_timeout}s"
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
