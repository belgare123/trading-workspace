"""EventPublisher — абстракция публикации доменных событий.

Позволяет движкам (DecisionEngine, LifecycleEngine, QualityEngine и др.)
не зависеть от конкретной реализации EventStore.

Usage::

    class DecisionEngine:
        def __init__(self, publisher: EventPublisher):
            self._publisher = publisher

        async def process(self, ...):
            self._publisher.publish(DecisionEvent(...))

В будущем реализацию можно заменить на Kafka/Redis Streams/NATS.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class EventPublisher(Protocol):
    """Контракт публикации события.

    Единственный метод — publish(event).
    Синхронный — не требует await, подходит для текущей архитектуры.
    """

    def publish(self, event: Any) -> None:
        """Опубликовать доменное событие.

        Args:
            event: Доменное событие (DecisionEvent, LifecycleEvent, ...).
        """
        ...
