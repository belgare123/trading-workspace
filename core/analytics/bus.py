"""
Analytics Engine — Event Bus (Phase 11.9). Тонкий фасад над EventStore.

Режимы работы:
  - С EventStore: emit() пишет в журнал через publish_sync()
  - Без EventStore: чистая legacy-шина (локальные подписчики)
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

    def __init__(self, event_store: EventStore | None = None) -> None:
        self._store = event_store
        # Legacy fallback
        self._handlers: dict[str, list[Handler]] = {}

    def subscribe(self, event_type: str, handler: Handler) -> None:
        if self._store:
            self._store.on_sync(_make_analytics_wrapper(event_type, handler))
            logger.debug("Subscribed %s (via EventStore)", event_type)
            return
        self._handlers.setdefault(event_type, []).append(handler)

    def unsubscribe(self, event_type: str, handler: Handler) -> None:
        if self._store:
            logger.warning("unsubscribe() not supported via EventStore")
            return
        handlers = self._handlers.get(event_type, [])
        if handler in handlers:
            handlers.remove(handler)

    def emit(self, event: AnalyticsEvent) -> None:
        if self._store:
            stored = self._to_stored(event)
            self._store.publish_sync(stored)
            return
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

    def _to_stored(self, event: AnalyticsEvent) -> StoredEvent:
        return StoredEvent.new(
            aggregate=AGGREGATE_ANALYTICS,
            aggregate_id=f"analytics#{event.symbol or 'unknown'}",
            topic=f"analytics.{event.event_type}",
            source="analytics_engine",
            payload=json.dumps(event.to_dict()).encode("utf-8"),
        )


def _make_analytics_wrapper(event_type: str, handler: Handler) -> Callable[[StoredEvent], None]:
    """Wrap StoredEvent → AnalyticsEvent for legacy handler."""
    def wrapper(stored: StoredEvent) -> None:
        if stored.topic != event_type:
            return
        try:
            raw = json.loads(stored.payload.decode("utf-8"))
            event = AnalyticsEvent(
                event_type=raw.get("event_type", event_type),
                symbol=raw.get("symbol", ""),
                timestamp=raw.get("timestamp", 0.0),
                **{k: v for k, v in raw.items() if k not in ("event_type", "symbol", "timestamp")},
            )
            handler(event)
        except Exception:
            logger.exception("AnalyticsBus handler failed via EventStore")
    return wrapper
