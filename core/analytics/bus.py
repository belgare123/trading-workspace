"""
Analytics Engine — Event Bus (Phase 11.9).
"""

from __future__ import annotations

import logging
from typing import Callable

from core.analytics.events import (
    DOMINANCE_ALERT,
    HEATMAP_UPDATED,
    LIQUIDITY_ALERT,
    MARKET_PROFILE_UPDATED,
    REGIME_CHANGED,
    VOLATILITY_ALERT,
)
from core.analytics.models import (
    AnalyticsEvent,
    MarketProfile,
    RegimeType,
)

logger = logging.getLogger(__name__)

Handler = Callable[[AnalyticsEvent], None]


class AnalyticsBus:
    """Шина событий Analytics Engine."""

    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = {}

    def subscribe(self, event_type: str, handler: Handler) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    def unsubscribe(self, event_type: str, handler: Handler) -> None:
        handlers = self._handlers.get(event_type, [])
        if handler in handlers:
            handlers.remove(handler)

    def emit(self, event: AnalyticsEvent) -> None:
        for handler in self._handlers.get(event.event_type, []):
            try:
                handler(event)
            except Exception:
                logger.exception("AnalyticsBus: handler failed for %s", event.event_type)

    def emit_profile(self, symbol: str, profile: MarketProfile) -> None:
        self.emit(AnalyticsEvent(
            event_type=MARKET_PROFILE_UPDATED,
            symbol=symbol,
            profile=profile,
        ))

    def emit_regime_change(
        self,
        symbol: str,
        regime_before: MarketProfile,
        regime_after: MarketProfile,
    ) -> None:
        self.emit(AnalyticsEvent(
            event_type=REGIME_CHANGED,
            symbol=symbol,
            profile=regime_after,
            regime_before=regime_before.regime.regime,
            regime_after=regime_after.regime.regime,
        ))
