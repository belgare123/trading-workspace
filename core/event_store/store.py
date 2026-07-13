"""EventStore — единая точка входа для записи и чтения событий.

Persistence-first: запись в хранилище → dispatch подписчикам.

Typical usage::

    store = EventStore(repo=SQLiteEventRepository())
    await store.connect()

    # Write
    event = StoredEvent.new(...)
    stored = await store.publish(event)

    # Query
    results = await store.read(EventQuery(aggregate="decision"))

    # Subscribe
    store.on_topic("opportunity.created", handler)
"""

from __future__ import annotations

import logging
from typing import Any, AsyncIterator, Callable

from core.event_store.models import (
    EventNotFoundError,
    EventStoreError,
    StoredEvent,
)
from core.event_store.repository import EventQuery
from core.event_store.subscription import (
    EventHandler,
    SubscriptionHub,
    SyncEventHandler,
)

logger = logging.getLogger(__name__)


class EventStore:
    """Фасад Event Store.

    Комбинирует:
    - EventRepository (persistence)
    - SubscriptionHub (pub/sub)
    """

    def __init__(self, repository: EventRepository | None = None):
        from core.event_store.repository import EventRepository

        self._repo: EventRepository | None = repository
        self._subscriptions = SubscriptionHub()

    # ── Lifecycle ──

    async def connect(self) -> None:
        """Подключиться к хранилищу."""
        if self._repo is None:
            from core.event_store.sqlite_repo import SQLiteEventRepository

            self._repo = SQLiteEventRepository()
        if hasattr(self._repo, "connect"):
            await self._repo.connect()  # type: ignore
        logger.info("[eventstore] Connected (repo=%s)", type(self._repo).__name__)

    async def close(self) -> None:
        if self._repo:
            await self._repo.close()
        self._subscriptions.clear()

    @property
    def repo(self):
        if self._repo is None:
            raise EventStoreError("EventStore not connected. Call .connect() first.")
        return self._repo

    # ── Write ──

    async def publish(self, event: StoredEvent) -> StoredEvent:
        """Записать событие и разослать подписчикам (async).

        Persistence-first: запись → dispatch.
        """
        # persist
        stored = await self.repo.append(event)

        # dispatch
        await self._subscriptions.dispatch(stored)

        return stored

    def publish_sync(self, event: StoredEvent) -> StoredEvent:
        """Синхронная публикация (без await).

        Пишет в SQLite и вызывает sync-подписчиков.
        Подходит для emit() в существующих Bus-классах.
        """
        stored = self.repo.sync_append(event)  # type: ignore[union-attr]
        self._subscriptions.sync_dispatch(stored)
        return stored

    async def publish_batch(self, events: list[StoredEvent]) -> list[StoredEvent]:
        """Записать батч и разослать."""
        stored = []
        for ev in events:
            stored.append(await self.repo.append(ev))
        for ev in stored:
            await self._subscriptions.dispatch(ev)
        return stored

    # ── Read ──

    async def read(self, query: EventQuery) -> list[StoredEvent]:
        return await self.repo.read(query)

    async def read_one(self, event_id: str) -> StoredEvent:
        return await self.repo.read_one(event_id)

    async def count(self, query: EventQuery) -> int:
        return await self.repo.count(query)

    async def latest_version(self, aggregate_id: str) -> int:
        return await self.repo.latest_version(aggregate_id)

    async def tail(self, limit: int = 50) -> list[StoredEvent]:
        return await self.repo.tail(limit)

    async def iter_all(self, query: EventQuery) -> AsyncIterator[StoredEvent]:
        async for ev in self.repo.iter_all(query):
            yield ev

    # ── Query shorthands ──

    async def by_correlation(self, correlation_id: str, limit: int = 100) -> list[StoredEvent]:
        """Все события одной цепочки."""
        return await self.repo.read(
            EventQuery(correlation_id=correlation_id, limit=limit)
        )

    async def by_aggregate(
        self, aggregate: str, aggregate_id: str, limit: int = 100
    ) -> list[StoredEvent]:
        """Все события одного агрегата."""
        return await self.repo.read(
            EventQuery(aggregate=aggregate, aggregate_id=aggregate_id, limit=limit)
        )

    async def by_topic(self, topic: str, limit: int = 100) -> list[StoredEvent]:
        """Все события одного типа."""
        return await self.repo.read(EventQuery(topic=topic, limit=limit))

    async def since(self, timestamp: float, limit: int = 100) -> list[StoredEvent]:
        """События после отметки времени."""
        return await self.repo.read(
            EventQuery(from_timestamp=timestamp, limit=limit)
        )

    # ── Subscribe ──

    def on_topic(self, topic: str, handler: EventHandler) -> Callable[[], None]:
        return self._subscriptions.on_topic(topic, handler)

    def on_aggregate(self, aggregate: str, handler: EventHandler) -> Callable[[], None]:
        return self._subscriptions.on_aggregate(aggregate, handler)

    def on_any(self, handler: EventHandler) -> Callable[[], None]:
        return self._subscriptions.on_any(handler)

    def on_sync(self, handler: SyncEventHandler) -> Callable[[], None]:
        return self._subscriptions.on_sync(handler)


# ── Singleton ──

_event_store: EventStore | None = None


def get_event_store() -> EventStore:
    global _event_store
    if _event_store is None:
        _event_store = EventStore()
    return _event_store


def reset_event_store() -> None:
    global _event_store
    _event_store = None


__all__ = [
    "EventStore",
    "EventQuery",
    "StoredEvent",
    "get_event_store",
    "reset_event_store",
]
