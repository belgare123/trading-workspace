"""
Analytics Engine — Phase 11.

Рыночная аналитика: режимы, волатильность, ликвидность, доминирование.

Компоненты:
  11.1  Models       — RegimeType, VolatilityState, LiquidityState,
                       MarketRegime, MarketProfile, MarketHeatmap
  11.2  Regime       — RegimeDetector (10 типов режимов)
  11.3  Volatility   — VolatilityAnalyzer (ATR, BB, состояние)
  11.4  Liquidity    — LiquidityAnalyzer (спред, глубина, объём)
  11.5  Session      — Торговые сессии (Asia/London/NY)
  11.6  Dominance    — DominanceAnalyzer (BTC/Alt тренды)
  11.7  Profile      — ProfileBuilder (сборка полной картины)
  11.8  Heatmap      — HeatmapBuilder (мульти-символьная карта)
  11.9  Events       — Analytics Events (6 типов)
  11.10 Bus          — AnalyticsBus
  11.11 Engine       — AnalyticsEngine (оркестратор)
"""

from core.analytics.bus import AnalyticsBus
from core.analytics.dominance import DominanceAnalyzer, DominanceTrend
from core.analytics.engine import AnalyticsEngine
from core.analytics.events import (
    DOMINANCE_ALERT,
    HEATMAP_UPDATED,
    LIQUIDITY_ALERT,
    MARKET_PROFILE_UPDATED,
    REGIME_CHANGED,
    VOLATILITY_ALERT,
)
from core.analytics.heatmap import HeatmapBuilder
from core.analytics.liquidity import LiquidityAnalyzer, LiquidityState
from core.analytics.models import (
    AnalyticsEvent,
    MarketHeatmap,
    MarketProfile,
    MarketRegime,
    RegimeType,
    SessionType,
    VolatilityProfile,
    VolatilityState,
)
from core.analytics.profile import ProfileBuilder
from core.analytics.regime import RegimeDetector
from core.analytics.volatility import VolatilityAnalyzer

__all__ = [
    # Models
    "RegimeType",
    "SessionType",
    "VolatilityState",
    "MarketRegime",
    "MarketProfile",
    "MarketHeatmap",
    "AnalyticsEvent",
    # Core
    "RegimeDetector",
    "VolatilityAnalyzer",
    "LiquidityAnalyzer",
    "DominanceAnalyzer",
    "ProfileBuilder",
    "HeatmapBuilder",
    "AnalyticsBus",
    "AnalyticsEngine",
    # Events
    "REGIME_CHANGED",
    "MARKET_PROFILE_UPDATED",
    "VOLATILITY_ALERT",
    "LIQUIDITY_ALERT",
    "DOMINANCE_ALERT",
    "HEATMAP_UPDATED",
    # Re-exports
    "DominanceTrend",
    "LiquidityState",
]
