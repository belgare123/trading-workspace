"""
Strategy Weight Engine — система весов стратегий для взвешенного консенсуса.

Каждая стратегия получает вес на основе:
  - WinRate (процент успешных сигналов)
  - Total сигналов (больше данных = стабильнее вес)
  - Времени последнего обновления

Usage:
    weights = StrategyWeightEngine()
    weights.update("Momentum", won=True)
    weights.update("Momentum", won=False)
    w = weights.get_weight("Momentum")  # 0.95

    # Взвешенный консенсус:
    weight_map = weights.get_all_weights()  # {"Momentum": 1.42, "ICT": 0.74}
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from core.decision.models import StrategyWeight

logger = logging.getLogger(__name__)


class StrategyWeightEngine:
    """Управление весами стратегий.

    Каждый вызов update() учитывает результат сигнала:
      - won=True:  win_rate растёт
      - won=False: win_rate падает

    Вес вычисляется как:
      weight = 1.0 + (win_rate - 0.5) * 2.0
      (диапазон ~0.0–2.0, где 0.5 = нейтральный)

    Usage:
        swe = StrategyWeightEngine()
        swe.update("Momentum", won=True)
        swe.update("ICT", won=False)
        swe.update("Momentum", won=True)

        print(swe.get_weight("Momentum"))  # ~1.33
        print(swe.get_weight("ICT"))       # ~0.67
    """

    def __init__(self) -> None:
        self._weights: dict[str, StrategyWeight] = {}

    def update(
        self,
        strategy: str,
        won: bool,
    ) -> StrategyWeight:
        """Обновить вес стратегии после сигнала.

        Используется простое скользящее среднее:
          win_rate = (win_rate * (n-1) + result) / n

        Args:
            strategy: Имя стратегии.
            won:      True если сигнал был успешным.

        Returns:
            Обновлённый StrategyWeight.
        """
        if strategy not in self._weights:
            self._weights[strategy] = StrategyWeight(strategy=strategy)

        sw = self._weights[strategy]
        sw.total_signals += 1

        # Скользящее среднее win_rate
        n = sw.total_signals
        value = 1.0 if won else 0.0
        sw.win_rate = (sw.win_rate * (n - 1) + value) / n

        # Пересчёт веса
        sw.weight = self._compute_weight(sw)
        sw.updated_at = datetime.utcnow().timestamp()

        return sw

    def get_weight(self, strategy: str) -> float:
        """Получить текущий вес стратегии.

        Args:
            strategy: Имя стратегии.

        Returns:
            Вес (1.0 = нейтральный, >1 = больше влияние).
        """
        sw = self._weights.get(strategy)
        if sw is None:
            return 1.0
        return sw.weight

    def get_all_weights(self) -> dict[str, float]:
        """Получить карту всех весов.

        Returns:
            {strategy: weight}.
        """
        return {
            name: sw.weight
            for name, sw in self._weights.items()
        }

    def get_weight_objects(self) -> dict[str, StrategyWeight]:
        """Получить все объекты StrategyWeight."""
        return dict(self._weights)

    def get_or_create(self, strategy: str) -> StrategyWeight:
        """Получить или создать вес для стратегии.

        Args:
            strategy: Имя стратегии.

        Returns:
            StrategyWeight.
        """
        if strategy not in self._weights:
            self._weights[strategy] = StrategyWeight(strategy=strategy)
        return self._weights[strategy]

    def reset(self, strategy: str) -> None:
        """Сбросить вес стратегии к нейтральному.

        Args:
            strategy: Имя стратегии.
        """
        self._weights[strategy] = StrategyWeight(strategy=strategy)
        logger.info("Reset weight for strategy: %s", strategy)

    def reset_all(self) -> None:
        """Сбросить все веса."""
        self._weights.clear()
        logger.info("Reset all strategy weights")

    @staticmethod
    def _compute_weight(sw: StrategyWeight) -> float:
        """Вычислить вес на основе win_rate.

        Формула: 1.0 + (win_rate - 0.5) * 2.0

        Результат:
          - win_rate 0.5  → weight 1.0 (нейтрально)
          - win_rate 0.75 → weight 1.5 (выше)
          - win_rate 0.25 → weight 0.5 (ниже)
        """
        raw = 1.0 + (sw.win_rate - 0.5) * 2.0
        return max(0.1, min(2.0, round(raw, 4)))

    def to_dict(self) -> dict[str, dict[str, Any]]:
        return {
            name: sw.to_dict()
            for name, sw in self._weights.items()
        }
