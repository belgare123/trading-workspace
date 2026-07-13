"""SubscriptionHub — pub/sub поверх EventStore.

Позволяет подписчикам получать уведомления о новых событиях,
сохраняя обратную совместимость со старыми Bus-классами.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable, Coroutine

from core.event_store.models import StoredEvent

logger = logging.getLogger(__name__)

# Подписчик — корутина, получающая StoredEvent
EventHandler = Callable[[StoredEvent], Coroutine[Any, Any, None]]
SyncEventHandler = Callable[[StoredEvent], None]


class SubscriptionHub:
    """Центральный pub/sub для событий EventStore.

    - Подписка по topic (glob-стиль: ``opportunity.*``).
    - Подписка по aggregate.
    - Глобальная подписка (все события).

    Thread-safe (asyncio.Lock).
    """

    def __init__(self) -> None:
        self._topic_handlers: dict[str, list[EventHandler]] = {}
        self._aggregate_handlers: dict[str, list[EventHandler]] = {}
        self._all_handlers: list[EventHandler] = []
        self._sync_handlers: list[SyncEventHandler] = []
        self._lock = asyncio.Lock()

    # ── Subscribe ──

    def on_topic(self, topic: str, handler: EventHandler) -> Callable[[], None]:
        """Подписаться на topic (точное совпадение)."""
        self._topic_handlers.setdefault(topic, []).append(handler)

        def unsubscribe() -> None:
            handlers = self._topic_handlers.get(topic, [])
            if handler in handlers:
                handlers.remove(handler)

        return unsubscribe

    def on_aggregate(self, aggregate: str, handler: EventHandler) -> Callable[[], None]:
        """Подписаться на aggregate (все события агрегата)."""
        self._aggregate_handlers.setdefault(aggregate, []).append(handler)

        def unsubscribe() -> None:
            handlers = self._aggregate_handlers.get(aggregate, [])
            if handler in handlers:
                handlers.remove(handler)

        return unsubscribe

    def on_any(self, handler: EventHandler) -> Callable[[], None]:
        """Подписаться на все события."""
        self._all_handlers.append(handler)

        def unsubscribe() -> None:
            if handler in self._all_handlers:
                self._all_handlers.remove(handler)

        return unsubscribe

    def on_sync(self, handler: SyncEventHandler) -> Callable[[], None]:
        """Синхронный подписчик (для фасадов Bus, без async)."""
        self._sync_handlers.append(handler)

        def unsubscribe() -> None:
            if handler in self._sync_handlers:
                self._sync_handlers.remove(handler)

        return unsubscribe

    # ── Dispatch ──

    async def dispatch(self, event: StoredEvent) -> None:
        """Разослать событие всем подходящим подписчикам."""
        # 1. Специфичные по topic
        for handler in self._topic_handlers.get(event.topic, []):
            try:
                await handler(event)
            except Exception:
                logger.exception(
                    "Topic handler failed for %s", event.topic
                )

        # 2. По aggregate
        for handler in self._aggregate_handlers.get(event.aggregate, []):
            try:
                await handler(event)
            except Exception:
                logger.exception(
                    "Aggregate handler failed for %s", event.aggregate
                )

        # 3. Глобальные async
        for handler in self._all_handlers:
            try:
                await handler(event)
            except Exception:
                logger.exception("Global async handler failed")

        # 4. Синхронные
        for handler in self._sync_handlers:
            try:
                handler(event)
            except Exception:
                logger.exception("Global sync handler failed")

    def sync_dispatch(self, event: StoredEvent) -> None:
        """Синхронный dispatch (без await).

        Вызывает только синхронных подписчиков (on_sync).
        Async-подписчики игнорируются — для них есть dispatch().
        """
        for handler in self._sync_handlers:
            try:
                handler(event)
            except Exception:
                logger.exception("Global sync handler failed (sync_dispatch)")

    # ── State ──

    @property
    def subscriber_count(self) -> int:
        return (
            sum(len(v) for v in self._topic_handlers.values())
            + sum(len(v) for v in self._aggregate_handlers.values())
            + len(self._all_handlers)
            + len(self._sync_handlers)
        )

    def clear(self) -> None:
        self._topic_handlers.clear()
        self._aggregate_handlers.clear()
        self._all_handlers.clear()
        self._sync_handlers.clear()
