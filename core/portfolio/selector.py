"""
Portfolio Engine — Strategy Selector (Phase 12.4).

Выбор лучших стратегий для текущего режима.
"""

from __future__ import annotations

import logging
from typing import Any

from core.analytics import MarketRegime, RegimeType
from core.portfolio.models import PortfolioConfig, PortfolioState
from core.portfolio.weight import WeightEngine
from core.quality.models import RatingPassport

logger = logging.getLogger(__name__)


class StrategySelector:
    """Селектор стратегий для текущего режима."""

    def __init__(self, config: PortfolioConfig | None = None) -> None:
        self._config = config or PortfolioConfig()

    def select(
        self,
        state: PortfolioState,
        regime: MarketRegime,
        passports: dict[str, RatingPassport] | None = None,
    ) -> list[StrategySlot]:
        """Выбрать лучшие стратегии для текущего режима."""
        scored: list[tuple[float, StrategySlot]] = []

        for slot in state.slots.values():
            if not slot.enabled:
                continue

            # Проверка режима
            if slot.excluded_regimes and regime.regime in slot.excluded_regimes:
                continue
            if slot.allowed_regimes and regime.regime not in slot.allowed_regimes:
                continue

            # Оценка
            score = slot.base_weight
            boost = WeightEngine.REGIME_BOOST.get(regime.regime.value, 1.0)
            score *= boost

            if passport := (passports or {}).get(slot.name):
                score *= WeightEngine._quality_factor(passport)

            scored.append((score, slot))

        # Сортировка по убыванию
        scored.sort(key=lambda x: x[0], reverse=True)

        # Ограничение
        max_active = self._config.max_active_strategies
        return [s for _, s in scored[:max_active]]
