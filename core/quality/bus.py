"""
Quality Engine — Event Bus (Phase 10.8).
"""

from __future__ import annotations

import logging
from typing import Any, Callable

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
    """Шина событий Quality Engine."""

    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = {}

    def subscribe(self, event_type: str, handler: Handler) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    def unsubscribe(self, event_type: str, handler: Handler) -> None:
        handlers = self._handlers.get(event_type, [])
        if handler in handlers:
            handlers.remove(handler)

    def emit(self, event: QualityEvent) -> None:
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
