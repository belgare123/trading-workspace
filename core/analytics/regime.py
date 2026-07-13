"""
Analytics Engine — Regime Detector (Phase 11.1).

Определение рыночного режима на основе свечных данных.

Режимы:
  TRENDING_BULL, TRENDING_BEAR, RANGING,
  HIGH_VOLATILITY, LOW_VOLATILITY, BREAKOUT,
  CRASH, RECOVERY, DISTRIBUTION, ACCUMULATION
"""

from __future__ import annotations

import logging
import statistics
from typing import Any

from core.analytics.models import MarketRegime, RegimeType

logger = logging.getLogger(__name__)


class RegimeDetector:
    """Детектор рыночного режима."""

    def __init__(self, lookback: int = 50) -> None:
        self._lookback = lookback
        self._prev_regime: RegimeType | None = None
        self._regime_duration: dict[RegimeType, int] = {}

    def detect(self, candles: list[dict[str, Any]]) -> MarketRegime:
        """Определить текущий рыночный режим.

        Args:
            candles: Список свечей {open, high, low, close, volume}.

        Returns:
            MarketRegime с типом и уверенностью.
        """
        if not candles or len(candles) < self._lookback // 2:
            return MarketRegime(regime=RegimeType.UNKNOWN, confidence=0.0)

        closes = [c["close"] for c in candles[-self._lookback:]]
        highs = [c["high"] for c in candles[-self._lookback:]]
        lows = [c["low"] for c in candles[-self._lookback:]]

        # Основные метрики
        trend_strength = self._calc_trend_strength(closes)
        volatility = self._calc_volatility(highs, lows, closes)
        range_metric = self._calc_range_metric(closes, highs, lows)
        momentum = self._calc_momentum(closes)
        gap_metric = self._calc_gap(highs, lows)
        crash_metric = self._calc_crash(closes, lows)
        recovery_metric = self._calc_recovery(closes)

        # Определение режима
        regime, confidence = self._classify(
            trend_strength, volatility, range_metric, momentum,
            gap_metric, crash_metric, recovery_metric,
        )

        # Длительность
        if regime == self._prev_regime:
            self._regime_duration[regime] = self._regime_duration.get(regime, 0) + 1
        else:
            self._regime_duration[regime] = 1
            self._prev_regime = regime

        return MarketRegime(
            regime=regime,
            confidence=round(confidence, 4),
            duration_bars=self._regime_duration.get(regime, 1),
            strength=round(self._format_strength(trend_strength), 4),
        )

    def _calc_trend_strength(self, closes: list[float]) -> float:
        """Сила тренда: отношение изменения цены к волатильности.

        Returns: -1 (сильный нисходящий) .. +1 (сильный восходящий)
        """
        if len(closes) < 20:
            return 0.0
        change = closes[-1] - closes[0]
        # Аппроксимация волатильности средним истинным диапазоном
        diffs = [abs(closes[i] - closes[i - 1]) for i in range(1, len(closes))]
        volatility = statistics.mean(diffs) if diffs else 1
        raw = change / (volatility * len(closes) ** 0.5) if volatility > 0 else 0
        # Зажимаем в [-1, 1] через tanh-подобное
        return raw / (1 + abs(raw))

    def _calc_volatility(self, highs: list[float], lows: list[float],
                         closes: list[float]) -> float:
        """Текущая волатильность относительно средней."""
        if len(highs) < 14:
            return 1.0
        recent = highs[-14:]
        recent_l = lows[-14:]
        ranges = [recent[i] - recent_l[i] for i in range(len(recent))]
        current_avg = statistics.mean(ranges[-5:]) if len(ranges) >= 5 else statistics.mean(ranges)
        overall_avg = statistics.mean(ranges)
        return current_avg / overall_avg if overall_avg > 0 else 1.0

    def _calc_range_metric(self, closes: list[float], highs: list[float],
                           lows: list[float]) -> float:
        """Метрика флета: 1 = флет, 0 = тренд."""
        if len(closes) < 20:
            return 0.5
        highest = max(highs[-20:])
        lowest = min(lows[-20:])
        total_range = highest - lowest
        if total_range == 0:
            return 1.0
        # Среднее движение свечи относительно общего диапазона
        avg_candle = statistics.mean(
            [highs[-20:][i] - lows[-20:][i] for i in range(20)]
        )
        return min(1.0, avg_candle / (total_range / 20) * 2)

    def _calc_momentum(self, closes: list[float]) -> float:
        """Моментум за последние N свечей (-1..1)."""
        if len(closes) < 10:
            return 0.0
        short = closes[-1] - closes[-5]
        long_ = closes[-5] - closes[-10] if len(closes) >= 10 else 0
        mom = (short + long_) / (closes[-5] if closes[-5] > 0 else 1)
        return max(-1.0, min(1.0, mom * 10))

    def _calc_gap(self, highs: list[float], lows: list[float]) -> bool:
        """Обнаружение гэпа."""
        if len(highs) < 2:
            return False
        return lows[-1] > highs[-2] or highs[-1] < lows[-2]

    def _calc_crash(self, closes: list[float], lows: list[float]) -> float:
        """Метрика краша: насколько свеча выбивается из диапазона."""
        if len(closes) < 20:
            return 0.0
        recent_lows = lows[-20:-1]
        avg_low = statistics.mean(recent_lows)
        if avg_low == 0:
            return 0.0
        return (avg_low - lows[-1]) / avg_low

    def _calc_recovery(self, closes: list[float]) -> float:
        """Метрика восстановления после падения."""
        if len(closes) < 10:
            return 0.0
        min_price = min(closes[-10:])
        min_idx = closes[-10:].index(min_price)
        if min_idx == len(closes[-10:]) - 1:
            return 0.0
        recovery = (closes[-1] - min_price) / (closes[min_idx] if closes[min_idx] > 0 else 1)
        return max(0.0, min(1.0, recovery))

    def _classify(
        self,
        trend_strength: float,
        volatility: float,
        range_metric: float,
        momentum: float,
        has_gap: bool,
        crash_metric: float,
        recovery_metric: float,
    ) -> tuple[RegimeType, float]:
        """Классификация режима на основе метрик."""

        # Crash детекция
        if crash_metric > 0.05 and trend_strength < -0.3:
            return RegimeType.CRASH, min(1.0, crash_metric * 10)

        # Breakout детекция
        if has_gap and abs(trend_strength) > 0.3:
            return RegimeType.BREAKOUT, 0.7 + abs(trend_strength) * 0.3

        # Recovery детекция
        if recovery_metric > 0.5 and trend_strength > 0.2:
            return RegimeType.RECOVERY, recovery_metric

        # High volatility
        if volatility > 1.5:
            if trend_strength > 0.4:
                return RegimeType.TRENDING_BULL, min(1.0, trend_strength)
            elif trend_strength < -0.4:
                return RegimeType.TRENDING_BEAR, min(1.0, abs(trend_strength))
            return RegimeType.HIGH_VOLATILITY, min(1.0, (volatility - 1.5) * 2)

        # Trending
        if trend_strength > 0.3:
            if momentum > 0.3:
                return RegimeType.TRENDING_BULL, trend_strength
            return RegimeType.DISTRIBUTION, 0.5 + abs(momentum) * 0.5
        elif trend_strength < -0.3:
            if momentum < -0.3:
                return RegimeType.TRENDING_BEAR, abs(trend_strength)
            return RegimeType.ACCUMULATION, 0.5 + abs(momentum) * 0.5

        # Ranging vs Low volatility
        if range_metric > 0.7:
            if volatility < 0.7:
                return RegimeType.LOW_VOLATILITY, 1.0 - volatility
            return RegimeType.RANGING, range_metric

        return RegimeType.UNKNOWN, 0.0

    @staticmethod
    def _format_strength(s: float) -> float:
        """Форматирование силы в -1..1."""
        return max(-1.0, min(1.0, s))

    def reset(self) -> None:
        self._prev_regime = None
        self._regime_duration.clear()
