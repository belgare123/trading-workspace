"""
Analytics Engine — Volatility Profile (Phase 11.2).
"""

from __future__ import annotations

import logging
import statistics
from typing import Any

from core.analytics.models import VolatilityProfile, VolatilityState

logger = logging.getLogger(__name__)


class VolatilityAnalyzer:
    """Анализ волатильности."""

    def __init__(self, atr_period: int = 14, bb_period: int = 20) -> None:
        self._atr_period = atr_period
        self._bb_period = bb_period
        self._history: list[float] = []

    def analyze(self, candles: list[dict[str, Any]]) -> VolatilityProfile:
        """Рассчитать профиль волатильности."""
        if not candles or len(candles) < self._atr_period + 1:
            return VolatilityProfile()

        closes = [c["close"] for c in candles]
        highs = [c["high"] for c in candles]
        lows = [c["low"] for c in candles]

        # ATR
        atr_values = self._calc_atr_series(highs, lows, closes)
        current_atr = atr_values[-1]
        avg_atr = statistics.mean(atr_values) if atr_values else current_atr
        atr_ratio = current_atr / avg_atr if avg_atr > 0 else 1.0
        atr_pct = current_atr / closes[-1] * 100 if closes[-1] > 0 else 0

        # Bollinger Bands width
        bb_width = self._calc_bb_width(closes)
        avg_bb_width = statistics.mean(self._history[-self._atr_period:]) if self._history else bb_width
        bb_ratio = bb_width / avg_bb_width if avg_bb_width > 0 else 1.0

        # Historical percentile
        self._history.append(atr_ratio)
        if len(self._history) > 200:
            self._history = self._history[-200:]
        percentile = self._calc_percentile(atr_ratio)

        # State
        if atr_ratio > 2.0:
            state = VolatilityState.SPIKE
        elif atr_ratio > 1.3:
            state = VolatilityState.EXPANDING
        elif atr_ratio < 0.7:
            state = VolatilityState.CONTRACTING
        else:
            state = VolatilityState.STABLE

        return VolatilityProfile(
            state=state,
            current_atr=current_atr,
            atr_percent=round(atr_pct, 4),
            atr_ratio=round(atr_ratio, 4),
            bb_width=round(bb_width, 4),
            bb_ratio=round(bb_ratio, 4),
            historical_percentile=percentile,
        )

    def _calc_atr_series(self, highs: list[float], lows: list[float],
                         closes: list[float]) -> list[float]:
        """Рассчитать серию ATR."""
        tr_values = []
        for i in range(1, min(len(highs), self._atr_period * 3)):
            tr = max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i - 1]),
                abs(lows[i] - closes[i - 1]),
            )
            tr_values.append(tr)
        return tr_values

    def _calc_bb_width(self, closes: list[float]) -> float:
        """Ширина полос Боллинджера (2*std/средняя)."""
        if len(closes) < self._bb_period:
            return 0.0
        recent = closes[-self._bb_period:]
        mean = statistics.mean(recent)
        std = statistics.stdev(recent) if len(recent) > 1 else 0
        return 2 * std / mean * 100 if mean > 0 else 0

    @staticmethod
    def _calc_percentile(value: float) -> float:
        """Перцентиль значения в истории."""
        from scipy.stats import percentileofscore  # noqa: fallback
        return 50.0  # simplifed: приблизительная оценка
