"""Replay Events Bus — тонкий фасад над EventStore для Market Replay Framework.

Подписчики: Timeline → Source → Strategies → Decision → Lifecycle → Quality
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable

from core.event_store import (
    AGGREGATE_MARKET,
    EventStore,
    StoredEvent,
)
from core.replay.models import ReplayEvent, ReplaySnapshot, ReplayContext

logger = logging.getLogger(__name__)

# Типы событий Replay Bus
REPLAY_STARTED = "replay.started"
REPLAY_STOPPED = "replay.stopped"
REPLAY_PAUSED = "replay.paused"
REPLAY_RESUMED = "replay.resumed"
REPLAY_SEEK = "replay.seek"
REPLAY_EVENT = "replay.event"
REPLAY_COMPLETED = "replay.completed"
REPLAY_ERROR = "replay.error"
REPLAY_SNAPSHOT = "replay.snapshot"
REPLAY_PROGRESS = "replay.progress"
REPLAY_BREAKPOINT = "replay.breakpoint"


EventHandler = Callable[[str, dict[str, Any]], None]


class ReplayBus:
    """Шина событий для Market Replay Framework — тонкий фасад над EventStore.

    Отличия от других Bus: emit() принимает (event_type: str, data: dict).
    """

    def __init__(self, event_store: EventStore) -> None:
        self._store = event_store

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """Подписаться на тип события."""
        self._store.on_sync(_make_replay_wrapper(event_type, handler))
        logger.debug("Subscribed to %s (via EventStore)", event_type)

    def unsubscribe(self, event_type: str, handler: EventHandler) -> None:
        """Отписаться от типа события."""
        logger.warning("unsubscribe() not supported via EventStore")

    def emit(self, event_type: str, data: dict[str, Any] | None = None) -> None:
        """Отправить событие."""
        payload = data or {}
        stored = StoredEvent.new(
            aggregate=AGGREGATE_MARKET,
            aggregate_id=f"replay#{event_type}",
            topic=event_type,
            source="replay_engine",
            payload=json.dumps({
                "event_type": event_type,
                "data": payload,
            }).encode("utf-8"),
        )
        self._store.publish_sync(stored)

    @property
    def history(self) -> list[tuple[str, dict[str, Any]]]:
        return []

    def clear_history(self) -> None:
        logger.warning("clear_history() not supported via EventStore")

    def emit_event(self, event: ReplayEvent) -> None:
        """Удобный метод: отправить ReplayEvent в шину."""
        self.emit(REPLAY_EVENT, {"event": event.to_dict()})

    def emit_snapshot(self, snapshot: ReplaySnapshot) -> None:
        """Удобный метод: отправить Snapshot в шину."""
        self.emit(REPLAY_SNAPSHOT, {"snapshot": snapshot.to_dict()})

    def emit_progress(self, context: ReplayContext) -> None:
        """Удобный метод: отправить прогресс в шину."""
        self.emit(REPLAY_PROGRESS, {
            "current_index": context.current_index,
            "current_timestamp": context.current_timestamp,
            "total": len(context.package.events) if context.package else 0,
            "speed": context.current_speed,
        })


def _make_replay_wrapper(event_type: str, handler: EventHandler) -> Any:
    """Create a wrapper that converts StoredEvent → (str, dict)."""
    from core.event_store.models import StoredEvent as SE

    def wrapper(stored: SE) -> None:
        if stored.topic != event_type:
            return
        try:
            raw = json.loads(stored.payload.decode("utf-8"))
            handler(raw.get("event_type", event_type), raw.get("data", {}))
        except Exception:
            logger.exception("ReplayBus handler failed via EventStore")
    return wrapper
