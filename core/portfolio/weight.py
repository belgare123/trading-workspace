"""
Portfolio Engine — Weight Engine (Phase 12.3).

Динамическое взвешивание стратегий.

Комбинирует:
  - Базовый вес стратегии
  - Качество стратегии (из Quality Engine)
  - Рыночный режим (из Analytics Engine)
  - Диверсификацию
"""

from __future__ import annotations

import logging
from typing import Any

from core.analytics import MarketRegime, RegimeType
from core.portfolio.models import PortfolioConfig, PortfolioState, StrategySlot
from core.quality.models import RatingPassport

logger = logging.getLogger(__name__)


class WeightEngine:
    """Динамический расчёт весов стратегий."""

    REGIME_BOOST: dict[str, float] = {
        "trending_bull": 1.2,
        "trending_bear": 1.1,
        "breakout": 1.3,
        "recovery": 1.15,
        "high_volatility": 0.8,
        "low_volatility": 1.1,
        "ranging": 1.0,
        "crash": 0.5,
        "distribution": 0.9,
        "accumulation": 1.05,
    }

    def __init__(self, config: PortfolioConfig | None = None) -> None:
        self._config = config or PortfolioConfig()

    def calculate(
        self,
        slot: StrategySlot,
        regime: MarketRegime,
        passport: RatingPassport | None = None,
    ) -> float:
        """Рассчитать актуальный вес стратегии.

        Формула:
          weight = base_weight
                 * regime_boost(regime)
                 * quality_factor(rating)
                 / diversity_penalty

        Args:
            slot: Слот стратегии.
            regime: Текущий рыночный режим.
            passport: Паспорт качества стратегии (если есть).

        Returns:
            Вес в диапазоне [0, max_weight_per_strategy].
        """
        if not slot.enabled:
            return 0.0

        weight = slot.base_weight

        # Режимный boost
        boost = self.REGIME_BOOST.get(regime.regime.value, 1.0)
        weight *= boost

        # Качественный фактор
        if passport:
            qf = self._quality_factor(passport)
            weight *= qf

        # Диверсификация: ограничение макс веса
        weight = min(weight, self._config.max_weight_per_strategy)
        weight = max(weight, 0.0)

        return round(weight, 4)

    @staticmethod
    def _quality_factor(passport: RatingPassport) -> float:
        """Коэффициент качества стратегии.

        S: 1.3, A: 1.15, B: 1.0, C: 0.85, D: 0.6, F: 0.0
        """
        mapping = {
            "S": 1.3,
            "A": 1.15,
            "B": 1.0,
            "C": 0.85,
            "D": 0.6,
            "F": 0.0,
        }
        return mapping.get(passport.rating.value, 1.0)

    @staticmethod
    def normalize(weights: dict[str, float]) -> dict[str, float]:
        """Нормализовать веса так, чтобы сумма = 1.0."""
        total = sum(weights.values())
        if total == 0:
            return {k: 0.0 for k in weights}
        return {k: round(v / total, 4) for k, v in weights.items()}
