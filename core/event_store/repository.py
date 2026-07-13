"""EventRepository — абстракция хранения событий."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Protocol


# ── Query ──


@dataclass
class EventQuery:
    """Параметры фильтрации событий.

    Все критерии опциональны — None означает "без фильтра".
    Комбинируются через AND.
    """

    aggregate: str | None = None
    aggregate_id: str | None = None
    topic: str | None = None
    correlation_id: str | None = None
    causation_id: str | None = None
    source: str | None = None
    from_version: int | None = None
    to_version: int | None = None
    from_timestamp: float | None = None
    to_timestamp: float | None = None
    limit: int = 100
    offset: int = 0
    order: str = "asc"  # "asc" | "desc"

    def clone(self, **overrides: Any) -> EventQuery:
        data = {k: v for k, v in self.__dict__.items()}
        data.update(overrides)
        return EventQuery(**data)


# ── Repository interface ──


class EventRepository(abc.ABC):
    """Интерфейс хранилища событий.

    Позволяет заменить SQLite на PostgreSQL / DuckDB / ClickHouse
    без изменения кода EventStore.
    """

    @abc.abstractmethod
    async def append(self, event: StoredEvent, conn: Any = None) -> StoredEvent:
        """Записать одно событие в хранилище.

        Автоматически вычисляет aggregate_version = max(ver) + 1 для aggregate_id.
        Если event.aggregate_version == 0, вычисляет автоматически.
        """
        ...

    @abc.abstractmethod
    async def append_batch(self, events: list[StoredEvent], conn: Any = None) -> list[StoredEvent]:
        """Записать батч событий атомарно."""
        ...

    @abc.abstractmethod
    async def read(self, query: EventQuery) -> list[StoredEvent]:
        """Прочитать события по фильтру."""
        ...

    @abc.abstractmethod
    async def read_one(self, event_id: str) -> StoredEvent:
        """Прочитать одно событие по ID. Кидает EventNotFoundError."""
        ...

    @abc.abstractmethod
    async def count(self, query: EventQuery) -> int:
        """Количество событий по фильтру."""
        ...

    @abc.abstractmethod
    async def latest_version(self, aggregate_id: str) -> int:
        """Последняя версия агрегата (0 если нет событий)."""
        ...

    @abc.abstractmethod
    async def tail(self, limit: int = 50) -> list[StoredEvent]:
        """Последние N событий (глобально)."""
        ...

    @abc.abstractmethod
    async def iter_all(self, query: EventQuery) -> AsyncIterator[StoredEvent]:
        """Ленивый итератор по событиям (для Replay)."""
        ...

    @abc.abstractmethod
    async def close(self) -> None:
        """Закрыть соединение."""
        ...


# ── Forward ref (для type hints в repository) ──
# ruff: noqa: F811

from core.event_store.models import StoredEvent  # noqa: E402, F401

__all__ = [
    "EventQuery",
    "EventRepository",
    "StoredEvent",
]
