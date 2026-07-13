"""
Analytics Engine — Event Bus (Phase 11.9). Тонкий фасад над EventStore.
"""

from __future__ import annotations

import json
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
from core.event_store import (
    AGGREGATE_ANALYTICS,
    EventStore,
    StoredEvent,
)

logger = logging.getLogger(__name__)

Handler = Callable[[AnalyticsEvent], None]


class AnalyticsBus:
    """Шина событий Analytics Engine — тонкий фасад над EventStore."""

    def __init__(self, event_store: EventStore) -> None:
        self._store = event_store

    def subscribe(self, event_type: str, handler: Handler) -> None:
        self._store.on_sync(_make_analytics_wrapper(event_type, handler))
        logger.debug("Subscribed %s (via EventStore)", event_type)

    def unsubscribe(self, event_type: str, handler: Handler) -> None:
        logger.warning("unsubscribe() not supported via EventStore")

    def emit(self, event: AnalyticsEvent) -> None:
        stored = self._to_stored(event)
        self._store.publish_sync(stored)

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

    def _to_stored(self, event: AnalyticsEvent) -> StoredEvent:
        return StoredEvent.new(
            aggregate=AGGREGATE_ANALYTICS,
            aggregate_id=f"analytics#{event.symbol or 'unknown'}",
            topic=f"analytics.{event.event_type}",
            source="analytics_engine",
            payload=json.dumps(event.to_dict()).encode("utf-8"),
        )


def _make_analytics_wrapper(event_type: str, handler: Handler) -> Callable[[StoredEvent], None]:
    """Wrap StoredEvent → AnalyticsEvent."""
    def wrapper(stored: StoredEvent) -> None:
        if stored.topic != f"analytics.{event_type}":
            return
        try:
            raw = json.loads(stored.payload.decode("utf-8"))
            regime_before = RegimeType(raw["regime_before"]) if raw.get("regime_before") else None
            regime_after = RegimeType(raw["regime_after"]) if raw.get("regime_after") else None
            event = AnalyticsEvent(
                event_type=raw.get("event_type", event_type),
                symbol=raw.get("symbol", ""),
                timestamp=raw.get("timestamp", 0.0),
                regime_before=regime_before,
                regime_after=regime_after,
            )
            handler(event)
        except Exception:
            logger.exception("AnalyticsBus handler failed via EventStore")
    return wrapper
