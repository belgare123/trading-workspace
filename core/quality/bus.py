"""
Quality Engine — Event Bus (Phase 10.8). Тонкий фасад над EventStore.

Режимы работы:
  - С EventStore: emit() пишет в журнал через publish_sync()
  - Без EventStore: чистая legacy-шина (локальные подписчики)
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable

from core.event_store import (
    AGGREGATE_QUALITY,
    EventStore,
    StoredEvent,
)
from core.quality.events import (
    QUALITY_DECLINING,
    QUALITY_PASSPORT_READY,
    QUALITY_RATING_CHANGED,
    QUALITY_UPDATED,
)
from core.quality.models import QualityEvent, RatingPassport

logger = logging.getLogger(__name__)

Handler = Callable[[QualityEvent], None]


class QualityBus:
    """Шина событий Quality Engine — тонкий фасад над EventStore."""

    def __init__(self, event_store: EventStore | None = None) -> None:
        self._store = event_store
        # Legacy fallback
        self._handlers: dict[str, list[Handler]] = {}

    def subscribe(self, event_type: str, handler: Handler) -> None:
        if self._store:
            self._store.on_sync(_make_quality_wrapper(event_type, handler))
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

    def emit(self, event: QualityEvent) -> None:
        if self._store:
            stored = self._to_stored(event)
            self._store.publish_sync(stored)
            return
        for handler in self._handlers.get(event.event_type, []):
            try:
                handler(event)
            except Exception:
                logger.exception("QualityBus: handler failed for %s", event.event_type)

    def emit_passport(self, strategy_name: str, passport: RatingPassport) -> None:
        self.emit(QualityEvent(
            event_type=QUALITY_PASSPORT_READY,
            strategy_name=strategy_name,
            passport=passport,
        ))
        self.emit(QualityEvent(
            event_type=QUALITY_UPDATED,
            strategy_name=strategy_name,
            passport=passport,
        ))

    def emit_rating_change(
        self,
        strategy_name: str,
        rating_before: RatingPassport,
        rating_after: RatingPassport,
    ) -> None:
        self.emit(QualityEvent(
            event_type=QUALITY_RATING_CHANGED,
            strategy_name=strategy_name,
            rating_before=rating_before.rating,
            rating_after=rating_after.rating,
        ))

    def _to_stored(self, event: QualityEvent) -> StoredEvent:
        return StoredEvent.new(
            aggregate=AGGREGATE_QUALITY,
            aggregate_id=f"quality#{event.strategy_name or 'unknown'}",
            topic=f"quality.{event.event_type}",
            source="quality_engine",
            payload=json.dumps(event.to_dict()).encode("utf-8"),
        )


def _make_quality_wrapper(event_type: str, handler: Handler) -> Callable[[StoredEvent], None]:
    """Wrap StoredEvent → QualityEvent for legacy handler."""
    def wrapper(stored: StoredEvent) -> None:
        if stored.topic != event_type:
            return
        try:
            raw = json.loads(stored.payload.decode("utf-8"))
            event = QualityEvent(
                event_type=raw.get("event_type", event_type),
                strategy_name=raw.get("strategy_name", ""),
                timestamp=raw.get("timestamp", 0.0),
            )
            handler(event)
        except Exception:
            logger.exception("QualityBus handler failed via EventStore")
    return wrapper
