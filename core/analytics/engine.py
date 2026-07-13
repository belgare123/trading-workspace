"""
Analytics Engine — Orchestrator (Phase 11.10).

Центральный координатор Market Analytics.
"""

from __future__ import annotations

import logging
from typing import Any

from core.analytics.bus import AnalyticsBus
from core.analytics.heatmap import HeatmapBuilder
from core.analytics.models import AnalyticsEvent, MarketHeatmap, MarketProfile, RegimeType
from core.analytics.profile import ProfileBuilder
from core.analytics.session import get_current_session
from core.event_store import EventStore
from core.event_store.sqlite_repo import SQLiteEventRepository

logger = logging.getLogger(__name__)


class AnalyticsEngine:
    """Orchestrator Analytics Engine.

    Pipeline:
      candles + market data
        → ProfileBuilder (regime, volatility, liquidity, dominance, forces)
        → HeatmapBuilder (multi-symbol)
        → Bus (events)
    """

    def __init__(self, bus: AnalyticsBus | None = None) -> None:
        self._bus = bus or AnalyticsBus(
            event_store=EventStore(repository=SQLiteEventRepository(db_path=":memory:"))
        )
        self._builder = ProfileBuilder()
        self._heatmap = HeatmapBuilder()
        self._profiles: dict[str, MarketProfile] = {}

    @property
    def bus(self) -> AnalyticsBus:
        return self._bus

    def analyze(
        self,
        symbol: str,
        candles: list[dict],
        bid_ask_spread: float = 0.0,
        order_book_depth: float = 0.0,
        volume: float = 0.0,
        avg_volume: float = 0.0,
        large_trades: int = 0,
        bid_volume: float = 0.0,
        ask_volume: float = 0.0,
        btc_dominance: float = 0.0,
        btc_change_24h: float = 0.0,
        alt_change_24h: float = 0.0,
        dominance_history: list[float] | None = None,
    ) -> MarketProfile:
        """Полный цикл анализа одного символа.

        Returns:
            MarketProfile с полной картиной.
        """
        # 1. Сборка профиля
        profile = self._builder.build(
            symbol=symbol,
            candles=candles,
            bid_ask_spread=bid_ask_spread,
            order_book_depth=order_book_depth,
            volume=volume,
            avg_volume=avg_volume,
            large_trades=large_trades,
            bid_volume=bid_volume,
            ask_volume=ask_volume,
            btc_dominance=btc_dominance,
            btc_change_24h=btc_change_24h,
            alt_change_24h=alt_change_24h,
            dominance_history=dominance_history,
        )

        # 2. Смена режима?
        old_profile = self._profiles.get(symbol)
        if old_profile and old_profile.regime.regime != profile.regime.regime:
            self._bus.emit_regime_change(symbol, old_profile, profile)

        # 3. Сохранение
        self._profiles[symbol] = profile

        # 4. Событие
        self._bus.emit_profile(symbol, profile)

        return profile

    def get_profile(self, symbol: str) -> MarketProfile | None:
        return self._profiles.get(symbol)

    def get_all_profiles(self) -> list[MarketProfile]:
        return list(self._profiles.values())

    def get_heatmap(self) -> MarketHeatmap:
        """Построить тепловую карту по всем отслеживаемым символам."""
        return self._heatmap.build(self._profiles)

    def get_current_regime(self, symbol: str) -> RegimeType:
        profile = self._profiles.get(symbol)
        return profile.regime.regime if profile else RegimeType.UNKNOWN

    def get_current_session(self) -> str:
        return get_current_session().value

    def remove(self, symbol: str) -> None:
        self._profiles.pop(symbol, None)

    def clear(self) -> None:
        self._profiles.clear()
        self._builder = ProfileBuilder()
