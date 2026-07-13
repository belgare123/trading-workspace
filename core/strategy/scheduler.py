"""Strategy Scheduler — управление циклом выполнения стратегий.

Оборачивает вызов analyze_all() в tick() с поддержкой интервалов.

Пример:
    scheduler = StrategyScheduler(analyze_fn=engine.analyze_all, config=engine_config)
    results = await scheduler.tick()
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable, Coroutine

from core.strategy.signal import SignalBundle


logger = logging.getLogger(__name__)


class StrategyScheduler:
    """Цикл выполнения стратегий.

    Responsibilities:
        - tick() — один цикл с analyze_all() и опциональной паузой
        - interval / cooldown — управление частотой выполнения

    Composition:
        self._analyze_fn  — асинхронная функция analyze_all()
        self._analyze_on_tick — флаг выполнения analyze на каждый tick
        self._tick_interval   — пауза между tick() в секундах
    """

    def __init__(
        self,
        analyze_fn: Callable[[], Coroutine[Any, Any, dict[str, SignalBundle]]],
        analyze_on_tick: bool = True,
        tick_interval: float = 0.0,
        logger_override: logging.Logger | None = None,
    ) -> None:
        self._analyze_fn = analyze_fn
        self._analyze_on_tick = analyze_on_tick
        self._tick_interval = tick_interval
        self._logger = logger_override or logging.getLogger("strategy.scheduler")

    async def tick(self) -> dict[str, SignalBundle]:
        """Один цикл выполнения.

        Если analyze_on_tick = True — запускает analyze_all().
        Если tick_interval > 0 — делает паузу.

        Returns:
            Результаты analyze_all().
        """
        if not self._analyze_on_tick:
            return {}

        results = await self._analyze_fn()

        if self._tick_interval > 0:
            await asyncio.sleep(self._tick_interval)

        return results

    @property
    def interval(self) -> float:
        """Текущий интервал между tick()."""
        return self._tick_interval

    @interval.setter
    def interval(self, value: float) -> None:
        """Изменить интервал."""
        self._tick_interval = max(0.0, value)

    @property
    def analyze_on_tick(self) -> bool:
        """Выполнять analyze на каждый tick."""
        return self._analyze_on_tick

    @analyze_on_tick.setter
    def analyze_on_tick(self, value: bool) -> None:
        self._analyze_on_tick = value
