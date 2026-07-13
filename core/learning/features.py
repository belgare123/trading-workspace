"""
Learning Engine — Feature Extractors (Phase 13.1).

Извлечение признаков из сырых данных.
"""

from __future__ import annotations

import logging
import statistics
from typing import Any

from core.analytics import MarketProfile, RegimeType
from core.learning.models import Feature, FeatureSet
from core.quality import RatingPassport

logger = logging.getLogger(__name__)


class FeatureExtractor:
    """Извлечение признаков из различных источников."""

    @staticmethod
    def from_candles(candles: list[dict], prefix: str = "") -> FeatureSet:
        """Признаки из свечных данных.

        Включает: возвраты, волатильность, объём, диапазоны.
        """
        fs = FeatureSet()
        if not candles:
            return fs

        closes = [c["close"] for c in candles]
        highs = [c["high"] for c in candles]
        lows = [c["low"] for c in candles]
        volumes = [c.get("volume", 0) for c in candles]

        n = len(closes)
        p = prefix

        # Возвраты
        returns = [closes[i] / closes[i - 1] - 1 for i in range(1, n)] if n > 1 else [0]
        fs.add(f"{p}return_mean", statistics.mean(returns))
        fs.add(f"{p}return_std", statistics.stdev(returns) if len(returns) > 1 else 0)
        fs.add(f"{p}return_max", max(returns))
        fs.add(f"{p}return_min", min(returns))

        # Волатильность
        ranges = [highs[i] - lows[i] for i in range(n)]
        fs.add(f"{p}range_mean", statistics.mean(ranges))
        fs.add(f"{p}range_std", statistics.stdev(ranges) if n > 1 else 0)

        # Volume profile
        if volumes:
            fs.add(f"{p}vol_mean", statistics.mean(volumes))
            fs.add(f"{p}vol_ratio", volumes[-1] / statistics.mean(volumes) if statistics.mean(volumes) > 0 else 1)

        # Price levels
        fs.add(f"{p}price_current", closes[-1])
        fs.add(f"{p}price_high_20", max(closes[-20:]) if n >= 20 else max(closes))
        fs.add(f"{p}price_low_20", min(closes[-20:]) if n >= 20 else min(closes))

        # Trend
        if n >= 2:
            fs.add(f"{p}trend_short", (closes[-1] - closes[-5]) / closes[-5] if n >= 5 else
                    (closes[-1] - closes[0]) / closes[0])
            fs.add(f"{p}trend_long", (closes[-1] - closes[min(-20, -n)]) / closes[min(-20, -n)] if n >= 20
                    else (closes[-1] - closes[0]) / closes[0])

        return fs

    @staticmethod
    def from_market_profile(profile: MarketProfile, prefix: str = "market_") -> FeatureSet:
        """Признаки из рыночного профиля."""
        fs = FeatureSet()
        fs.add(f"{prefix}regime", float(profile.regime.regime.value.__hash__() % 100) / 100)
        fs.add(f"{prefix}regime_confidence", profile.regime.confidence)
        fs.add(f"{prefix}regime_strength", profile.regime.strength)
        fs.add(f"{prefix}volatility_atr", profile.volatility.current_atr)
        fs.add(f"{prefix}volatility_ratio", profile.volatility.atr_ratio)
        fs.add(f"{prefix}volatility_bb", profile.volatility.bb_width)
        fs.add(f"{prefix}liquidity_ratio", profile.liquidity.volume_ratio)
        fs.add(f"{prefix}liquidity_imbalance", profile.liquidity.imbalance)
        fs.add(f"{prefix}buyer_strength", profile.buyer_strength)
        fs.add(f"{prefix}seller_strength", profile.seller_strength)
        return fs

    @staticmethod
    def from_passport(passport: RatingPassport, prefix: str = "quality_") -> FeatureSet:
        """Признаки из паспорта качества."""
        fs = FeatureSet()
        fs.add(f"{prefix}rating", float(passport.rating.value.__hash__() % 100) / 100)
        fs.add(f"{prefix}overall_score", passport.overall_score)
        fs.add(f"{prefix}confidence", float(passport.confidence.value.__hash__() % 100) / 100)
        fs.add(f"{prefix}total_trades", float(passport.total_trades))
        for metric_name, metric_value in passport.metrics.items():
            fs.add(f"{prefix}{metric_name.value}", metric_value.value)
        return fs

    @staticmethod
    def merge(*sets: FeatureSet) -> FeatureSet:
        """Объединить несколько наборов признаков."""
        merged = FeatureSet()
        for fs in sets:
            for f in fs.features:
                merged.add(f.name, f.value)
        return merged
