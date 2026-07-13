"""
Portfolio Engine — Portfolio Optimizer (Phase 12.5).

Оптимизация распределения портфеля с учётом рисков.
"""

from __future__ import annotations

import logging
from typing import Any

from core.portfolio.models import (
    PortfolioAllocation,
    PortfolioConfig,
    PortfolioState,
    RiskLevel,
    StrategySlot,
)

logger = logging.getLogger(__name__)


class PortfolioOptimizer:
    """Оптимизатор портфеля.

    Задачи:
      - Ограничение веса на одну стратегию.
      - Проверка диверсификации.
      - Ребаланс при изменении режима.
      - Risk-based корректировка.
    """

    def __init__(self, config: PortfolioConfig | None = None) -> None:
        self._config = config or PortfolioConfig()
        self._rebalance_count = 0

    def optimize(
        self,
        state: PortfolioState,
        allocations: list[PortfolioAllocation],
    ) -> list[PortfolioAllocation]:
        """Оптимизировать распределение портфеля.

        Шаги:
          1. Применить ограничения по весу.
          2. Проверить диверсификацию.
          3. Риск-корректировка.
          4. Нормализация.

        Args:
            state: Состояние портфеля.
            allocations: Исходное распределение.

        Returns:
            Оптимизированное распределение.
        """
        if not allocations:
            return allocations

        # 1. Ограничение веса
        for alloc in allocations:
            max_w = self._config.max_weight_per_strategy
            if alloc.weight > max_w:
                alloc.weight = max_w

        # 2. Проверка диверсификации
        active = [a for a in allocations if a.weight > 0]
        if len(active) < self._config.min_strategies:
            logger.warning(
                "Only %d active strategies, min required: %d",
                len(active), self._config.min_strategies,
            )

        # 3. Риск-корректировка
        allocations = self._apply_risk_adjustment(allocations)

        # 4. Нормализация весов
        total = sum(a.weight for a in allocations)
        if total > 0:
            for alloc in allocations:
                alloc.weight = round(alloc.weight / total, 4)

        # 5. Финальный кап после нормализации
        risk_cap = self._config.max_weight_per_strategy
        if self._config.risk_level == RiskLevel.CONSERVATIVE:
            risk_cap = min(risk_cap, 0.25)
        elif self._config.risk_level == RiskLevel.AGGRESSIVE:
            risk_cap = min(risk_cap, 0.5)

        for alloc in allocations:
            if alloc.weight > risk_cap:
                alloc.weight = round(risk_cap, 4)

        self._rebalance_count += 1
        return allocations

    def _apply_risk_adjustment(
        self,
        allocations: list[PortfolioAllocation],
    ) -> list[PortfolioAllocation]:
        """Применить риск-корректировку (пред-нормализация)."""
        return allocations

    @property
    def rebalance_count(self) -> int:
        return self._rebalance_count

    def reset(self) -> None:
        self._rebalance_count = 0
