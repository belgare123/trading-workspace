"""Event Store — единый журнал событий платформы.

Фиксирует все доменные события: Decision, Lifecycle, Quality, Learning,
Analytics, Portfolio — с полным tracing (correlation_id / causation_id).

Паттерн: Event Sourcing Lite — persisted + subscribable + replayable.

Usage::

    from core.event_store import EventStore, EventQuery, StoredEvent

    store = EventStore()
    await store.connect()

    event = StoredEvent.new(
        aggregate="decision",
        aggregate_id="decision#abc123",
        topic="decision.accepted",
        correlation_id="chain-001",
        source="DecisionEngine",
        payload=json.dumps(decision_event.to_dict()).encode(),
    )
    stored = await store.publish(event)

    # Query
    results = await store.read(EventQuery(aggregate="decision"))

    # Subscribe
    store.on_topic("opportunity.created", my_handler)
"""

from __future__ import annotations

from core.event_store.models import (
    AGGREGATE_ANALYTICS,
    AGGREGATE_DECISION,
    AGGREGATE_LEARNING,
    AGGREGATE_MARKET,
    AGGREGATE_OPPORTUNITY,
    AGGREGATE_PLATFORM,
    AGGREGATE_PORTFOLIO,
    AGGREGATE_QUALITY,
    EventNotFoundError,
    EventStoreConnectionError,
    EventStoreError,
    StoredEvent,
)
from core.event_store.repository import EventQuery
from core.event_store.store import EventStore, get_event_store, reset_event_store

__all__ = [
    # Store
    "EventStore",
    "get_event_store",
    "reset_event_store",
    # Query
    "EventQuery",
    # Model
    "StoredEvent",
    # Constants
    "AGGREGATE_DECISION",
    "AGGREGATE_OPPORTUNITY",
    "AGGREGATE_MARKET",
    "AGGREGATE_PORTFOLIO",
    "AGGREGATE_QUALITY",
    "AGGREGATE_LEARNING",
    "AGGREGATE_ANALYTICS",
    "AGGREGATE_PLATFORM",
    # Exceptions
    "EventStoreError",
    "EventNotFoundError",
    "EventStoreConnectionError",
]
