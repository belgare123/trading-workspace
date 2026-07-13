"""
8.10 Opportunity Bus — тонкий фасад над EventStore для Lifecycle событий.

Decision Engine → OpportunityBus → EventStore → Replay / Quality / Dashboard / Learning

Режимы работы:
  - С EventStore: emit() пишет в журнал через publish_sync()
  - Без EventStore: чистая legacy-шина (локальные подписчики)
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from typing import Any, Callable

from core.event_store import (
    AGGREGATE_OPPORTUNITY,
    EventStore,
    StoredEvent,
)
from core.lifecycle.events import (
    EventHandler,
    LifecycleEvent,
    LifecycleEventType,
)

logger = logging.getLogger(__name__)


class OpportunityBus:
    """Шина событий жизненного цикла — тонкий фасад над EventStore.

    Usage:
        bus = OpportunityBus(event_store=store)
        bus.subscribe(LifecycleEventType.TRADE_CLOSED, my_handler)
        bus.publish(event)
    """

    def __init__(self, event_store: EventStore | None = None) -> None:
        self._store = event_store
        # Legacy fallback (без EventStore)
        self._handlers: dict[LifecycleEventType, list[EventHandler]] = defaultdict(list)
        self._all_handlers: list[EventHandler] = []
        self._history: list[LifecycleEvent] = []

    def subscribe(
        self,
        event_type: LifecycleEventType,
        handler: EventHandler,
    ) -> Callable[[], None]:
        """Подписаться на конкретный тип события."""
        if self._store:
            topic = f"lifecycle.{event_type.value}"

            def _wrapper(stored: StoredEvent) -> None:
                if stored.topic != topic:
                    return
                try:
                    raw = json.loads(stored.payload.decode("utf-8"))
                    event = LifecycleEvent(
                        type=LifecycleEventType(raw.get("type", "")),
                        opportunity_id=raw.get("opportunity_id", ""),
                        timestamp=raw.get("timestamp", 0.0),
                        source=raw.get("source", "lifecycle_engine"),
                        data=raw.get("data", {}),
                    )
                    handler(event)
                except Exception:
                    logger.exception("Handler failed for %s (via EventStore)", topic)

            self._store.on_sync(_wrapper)
            logger.debug("Subscribed to %s (via EventStore)", event_type.value)
            return lambda: None  # no-op unsubscribe

        # Legacy fallback
        self._handlers[event_type].append(handler)
        logger.debug("Subscribed to %s (legacy)", event_type.value)

        def unsubscribe() -> None:
            self._handlers[event_type].remove(handler)

        return unsubscribe

    def subscribe_all(self, handler: EventHandler) -> Callable[[], None]:
        """Подписаться на все события."""
        if self._store:
            # Subscribe to lifecycle.* via on_topic
            self._store.on_sync(_make_all_wrapper(handler))
            logger.debug("Subscribed to all lifecycle events (via EventStore)")
            return lambda: None

        # Legacy fallback
        self._all_handlers.append(handler)

        def unsubscribe() -> None:
            self._all_handlers.remove(handler)

        return unsubscribe

    def publish(self, event: LifecycleEvent) -> None:
        """Опубликовать событие."""
        if self._store:
            stored = self._to_stored(event)
            self._store.publish_sync(stored)
            return

        # Legacy fallback
        self._history.append(event)
        for handler in self._handlers.get(event.type, []):
            try:
                handler(event)
            except Exception as e:
                logger.error("Handler failed for %s: %s", event.type.value, e)
        for handler in self._all_handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error("All-handler failed for %s: %s", event.type.value, e)

    def get_history(
        self,
        event_type: LifecycleEventType | None = None,
        limit: int = 50,
    ) -> list[LifecycleEvent]:
        """Получить историю событий (legacy / from EventStore)."""
        if self._store:
            logger.warning("get_history() from EventStore not yet implemented")
            return []
        if event_type is None:
            return self._history[-limit:]
        return [e for e in self._history if e.type == event_type][-limit:]

    def clear(self) -> None:
        if self._store:
            logger.warning("clear() not supported via EventStore")
            return
        self._history.clear()

    @property
    def event_count(self) -> int:
        if self._store:
            return 0
        return len(self._history)

    def _to_stored(self, event: LifecycleEvent) -> StoredEvent:
        return StoredEvent.new(
            aggregate=AGGREGATE_OPPORTUNITY,
            aggregate_id=f"opportunity#{event.opportunity_id}",
            topic=f"lifecycle.{event.type.value}",
            timestamp=event.timestamp or None,
            source=event.source,
            payload=json.dumps(event.to_dict()).encode("utf-8"),
        )


def _make_all_wrapper(handler: EventHandler) -> Any:
    """Create wrapper for subscribe_all via EventStore."""
    from core.event_store.models import StoredEvent

    def wrapper(stored: StoredEvent) -> None:
        try:
            raw = json.loads(stored.payload.decode("utf-8"))
            event = LifecycleEvent(
                type=LifecycleEventType(raw.get("type", "")),
                opportunity_id=raw.get("opportunity_id", ""),
                timestamp=raw.get("timestamp", 0.0),
                source=raw.get("source", "lifecycle_engine"),
                data=raw.get("data", {}),
            )
            handler(event)
        except Exception:
            logger.exception("All-handler failed via EventStore")

    return wrapper
