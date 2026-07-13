"""
Confidence Engine (7.5) — пересчёт уверенности на основе нескольких факторов.

Исходный confidence от стратегии — только один из входов.
Финальный confidence учитывает:
  - Исходный confidence стратегии
  - Консенсус (сколько стратегий согласно)
  - Рыночный режим (тренд/флэт/волатильность)
  - Качество стратегии (win rate)
  - Общую волатильность
"""

from __future__ import annotations

import logging
from enum import Enum
from typing import Any

from core.decision.models import ConsensusResult, NormalizedSignal, StrategyWeight

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  Market Regime
# ═══════════════════════════════════════════════════════════════════


class MarketRegime(Enum):
    """Режим рынка."""
    TRENDING = "trending"
    RANGING = "ranging"
    VOLATILE = "volatile"
    UNKNOWN = "unknown"


# ═══════════════════════════════════════════════════════════════════
#  ConfidenceEngine
# ═══════════════════════════════════════════════════════════════════


class ConfidenceEngine:
    """Пересчёт уверенности сигнала/консенсуса.

    Формула:
      final_confidence = raw_confidence
        × consensus_boost    (если консенсус сильный)
        × regime_factor      (зависит от рыночного режима)
        × quality_factor     (win rate стратегии)
        × volatility_penalty (высокая волатильность = меньше уверенности)

    Usage:
        engine = ConfidenceEngine()
        final = engine.compute(
            raw_confidence=0.72,
            consensus=consensus_result,
            strategy_weight=weight,
            regime=MarketRegime.TRENDING,
            volatility=0.15,
        )
    """

    def compute(
        self,
        raw_confidence: float,
        consensus: ConsensusResult | None = None,
        strategy_weight: StrategyWeight | None = None,
        regime: MarketRegime = MarketRegime.UNKNOWN,
        volatility: float = 0.0,
    ) -> float:
        """Вычислить финальную уверенность.

        Args:
            raw_confidence:   Исходный confidence от стратегии (0.0–1.0).
            consensus:        Результат консенсуса (опционально).
            strategy_weight:  Вес/качество стратегии (опционально).
            regime:           Рыночный режим.
            volatility:       Текущая волатильность (0.0+).

        Returns:
            Финальный confidence (0.0–1.0).
        """
        confidence = raw_confidence

        # Consensus boost: если много стратегий согласно
        if consensus and consensus.participating:
            boost = self._consensus_boost(consensus)
            confidence *= (1.0 + boost)

        # Quality factor: win rate стратегии
        if strategy_weight and strategy_weight.win_rate > 0:
            qf = self._quality_factor(strategy_weight)
            confidence *= qf

        # Regime factor
        rf = self._regime_factor(regime)
        confidence *= rf

        # Volatility penalty
        vp = self._volatility_penalty(volatility)
        confidence *= vp

        return max(0.0, min(1.0, confidence))

    @staticmethod
    def _consensus_boost(consensus: ConsensusResult) -> float:
        """Коэффициент усиления от консенсуса.

        - 1 стратегия:    +0% (нет усиления)
        - 2–3 стратегии:  +10%
        - 4+ стратегии:   +20% если agreement > 0.7
        """
        n = len([p for p in consensus.participating
                 if consensus.weight_map.get(p, 1.0) > 0])
        if n < 2:
            return 0.0
        if n <= 3:
            return 0.10
        if consensus.agreement >= 0.7:
            return 0.20
        return 0.15

    @staticmethod
    def _quality_factor(sw: StrategyWeight) -> float:
        """Коэффициент качества стратегии.

        win_rate < 0.4:   0.85
        win_rate 0.4–0.6: 1.00
        win_rate > 0.6:   1.10
        """
        if sw.win_rate < 0.4:
            return 0.85
        if sw.win_rate > 0.6:
            return 1.10
        return 1.00

    @staticmethod
    def _regime_factor(regime: MarketRegime) -> float:
        """Коэффициент рыночного режима.

        TRENDING:  1.00 (доверяем тренду)
        RANGING:   0.90 (меньше уверенности)
        VOLATILE:  0.80 (хаотично)
        UNKNOWN:   0.95
        """
        factors = {
            MarketRegime.TRENDING: 1.00,
            MarketRegime.RANGING: 0.90,
            MarketRegime.VOLATILE: 0.80,
            MarketRegime.UNKNOWN: 0.95,
        }
        return factors.get(regime, 0.95)

    @staticmethod
    def _volatility_penalty(volatility: float) -> float:
        """Штраф за высокую волатильность.

        volatility < 0.1:  1.00 (низкая)
        0.1–0.3:          0.95
        0.3–0.5:          0.85
        > 0.5:            0.70
        """
        if volatility < 0.1:
            return 1.00
        if volatility < 0.3:
            return 0.95
        if volatility < 0.5:
            return 0.85
        return 0.70
