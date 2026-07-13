"""Event Store — единый persisted журнал событий платформы.

Архитектура:
- aggregate + topic (не stream)
- correlation_id + causation_id для трассировки
- Persistence-first: SQLite INSERT → dispatch подписчикам
- Sync publish для backward compat с существующими Bus-классами

Usage::

    store = EventStore(
        repository=SQLiteEventRepository(db_path=Path("events.db")),
    )
    await store.init()

    event = StoredEvent.new(
        aggregate=AGGREGATE_DECISION,
        aggregate_id="decision#123",
        topic="decision.created",
        event_type="DecisionCreated",
        payload=b'{"key": "value"}',
    )

    # Async publish (для новых сценариев)
    stored = await store.publish(event)

    # Sync publish (для существующих Bus-классов)
    stored = store.publish_sync(event)

    # Query
    results = await store.read(
        EventQuery(aggregate_id="decision#123", limit=10)
    )
"""

from core.event_store.models import (
    AGGREGATE_ANALYTICS,
    AGGREGATE_DECISION,
    AGGREGATE_LEARNING,
    AGGREGATE_MARKET,
    AGGREGATE_OPPORTUNITY,
    AGGREGATE_PLATFORM,
    AGGREGATE_PORTFOLIO,
    AGGREGATE_PORTFOLIO_EVENT,
    AGGREGATE_QUALITY,
    EventNotFoundError,
    EventStoreError,
    StoredEvent,
)
from core.event_store.publisher import EventPublisher
from core.event_store.repository import EventQuery, EventRepository
from core.event_store.sqlite_repo import SQLiteEventRepository
from core.event_store.store import EventStore
from core.event_store.reader import EventStoreReader, ReaderSnapshot, SnapshotReader
from core.event_store.subscription import SubscriptionHub
from core.event_store.trace import TraceNode, TraceGraph, TraceBuilder, trace_by_correlation, trace_event
from core.event_store.aggregate import AggregateStream, AggregateSnapshot, AggregateRepository, ConcurrencyError

__all__ = [
    # Models
    "StoredEvent",
    "EventQuery",
    "EventNotFoundError",
    "EventStoreError",
    "AGGREGATE_DECISION",
    "AGGREGATE_OPPORTUNITY",
    "AGGREGATE_ANALYTICS",
    "AGGREGATE_QUALITY",
    "AGGREGATE_PORTFOLIO",
    "AGGREGATE_PORTFOLIO_EVENT",
    "AGGREGATE_LEARNING",
    "AGGREGATE_MARKET",
    "AGGREGATE_PLATFORM",
    # Repository
    "EventRepository",
    "SQLiteEventRepository",
    # Store
    "EventStore",
    # Reader
    "EventStoreReader",
    "ReaderSnapshot",
    "SnapshotReader",
    # Trace
    "TraceNode",
    "TraceGraph",
    "TraceBuilder",
    "trace_by_correlation",
    "trace_event",
    # Aggregate
    "AggregateStream",
    "AggregateSnapshot",
    "AggregateRepository",
    "ConcurrencyError",
    "SubscriptionHub",
    # Protocol
    "EventPublisher",
]

__version__ = "0.1.0"
