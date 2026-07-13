"""
Portfolio Engine — Event Bus (Phase 12.8). Тонкий фасад над EventStore.
"""

from __future__ import annotations

import json
import logging
from typing import Callable

from core.event_store import (
    AGGREGATE_PORTFOLIO,
    EventStore,
    StoredEvent,
)
from core.portfolio.events import (
    PORTFOLIO_REBALANCED,
    PORTFOLIO_REGIME_CHANGED,
    PORTFOLIO_RISK_WARNING,
    PORTFOLIO_STRATEGY_DISABLED,
    PORTFOLIO_STRATEGY_ENABLED,
    PORTFOLIO_UPDATED,
    PORTFOLIO_WEIGHT_CHANGED,
)
from core.portfolio.models import PortfolioAllocation, PortfolioEvent

logger = logging.getLogger(__name__)

Handler = Callable[[PortfolioEvent], None]


class PortfolioBus:
    """Шина событий Portfolio Engine — тонкий фасад над EventStore."""

    def __init__(self, event_store: EventStore) -> None:
        self._store = event_store

    def subscribe(self, event_type: str, handler: Handler) -> None:
        self._store.on_sync(_make_portfolio_wrapper(event_type, handler))
        logger.debug("Subscribed %s (via EventStore)", event_type)

    def unsubscribe(self, event_type: str, handler: Handler) -> None:
        logger.warning("unsubscribe() not supported via EventStore")

    def emit(self, event: PortfolioEvent) -> None:
        stored = self._to_stored(event)
        self._store.publish_sync(stored)

    def emit_rebalance(self, allocations: list[PortfolioAllocation]) -> None:
        self.emit(PortfolioEvent(
            event_type=PORTFOLIO_REBALANCED,
            message=f"Rebalanced: {len(allocations)} allocations",
        ))

    def emit_regime_change(self, regime_name: str) -> None:
        self.emit(PortfolioEvent(
            event_type=PORTFOLIO_REGIME_CHANGED,
            message=f"Regime changed to {regime_name}",
        ))

    def _to_stored(self, event: PortfolioEvent) -> StoredEvent:
        return StoredEvent.new(
            aggregate=AGGREGATE_PORTFOLIO,
            aggregate_id=f"portfolio#{event.event_type}",
            topic=f"portfolio.{event.event_type}",
            source="portfolio_engine",
            payload=json.dumps(event.to_dict()).encode("utf-8"),
        )


def _make_portfolio_wrapper(event_type: str, handler: Handler) -> Callable[[StoredEvent], None]:
    """Wrap StoredEvent → PortfolioEvent."""
    def wrapper(stored: StoredEvent) -> None:
        if stored.topic != f"portfolio.{event_type}":
            return
        try:
            raw = json.loads(stored.payload.decode("utf-8"))
            event = PortfolioEvent(
                event_type=raw.get("event_type", event_type),
                message=raw.get("message", ""),
                timestamp=raw.get("timestamp", 0.0),
            )
            handler(event)
        except Exception:
            logger.exception("PortfolioBus handler failed via EventStore")
    return wrapper
