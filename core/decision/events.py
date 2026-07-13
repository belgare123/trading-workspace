"""Decision Events (7.8) — система событий Decision Engine.

Decision Engine публикует события, на которые подписываются:
  - Replay Engine
  - Dashboard
  - Telegram
  - Learning Engine
  - Quality Engine

Каждое событие содержит:
  - type: DecisionEventType
  - timestamp: время события
  - data: полезная нагрузка
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable

from core.decision.models import DecisionEventType, Opportunity, ConflictType
from core.event_store import (
    AGGREGATE_DECISION,
    EventStore,
    StoredEvent,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  DecisionEvent
# ═══════════════════════════════════════════════════════════════════


@dataclass
class DecisionEvent:
    """Одно событие от Decision Engine.

    Attributes:
        type:      Тип события.
        timestamp: Время (unix).
        data:      Данные события (Opportunity, ConsensusResult и т.д.).
        source:    Источник (обычно "decision_engine").
    """

    type: DecisionEventType
    timestamp: float = 0.0
    data: dict[str, Any] = field(default_factory=dict)
    source: str = "decision_engine"

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = datetime.utcnow().timestamp()

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type.value,
            "timestamp": self.timestamp,
            "data": self.data,
            "source": self.source,
        }


# Тип коллбэка для подписчика
EventHandler = Callable[[DecisionEvent], None]


# ═══════════════════════════════════════════════════════════════════
#  EventBus — thin facade over EventStore
# ═══════════════════════════════════════════════════════════════════


class EventBus:
    """Шина событий Decision Engine — тонкий фасад над EventStore.

    Все события пишутся в EventStore через publish_sync(),
    подписчики регистрируются через SubscriptionHub.

    Usage::

        store = EventStore(...)
        bus = EventBus(event_store=store)

        # Подписка (через EventStore)
        bus.on(DecisionEventType.OPPORTUNITY_CREATED, my_handler)

        # Публикация (пишет в SQLite + dispatch подписчикам)
        bus.emit(event)
    """

    def __init__(self, event_store: EventStore) -> None:
        self._store = event_store

    def on(
        self,
        event_type: DecisionEventType,
        handler: EventHandler,
    ) -> None:
        """Подписаться на событие.

        Args:
            event_type: Тип события.
            handler:    Функция-обработчик.
        """
        topic = f"decision.{event_type.value}"

        def _wrapper(stored: StoredEvent) -> None:
            if stored.topic != topic:
                return
            try:
                event = _stored_to_decision_event(stored)
                handler(event)
            except Exception:
                logger.exception(
                    "Handler failed for %s (via EventStore)", topic
                )

        self._store.on_sync(_wrapper)
        logger.debug(
            "Subscribed handler for %s (via EventStore: %s)",
            event_type.value, topic,
        )

    def off(
        self,
        event_type: DecisionEventType,
        handler: EventHandler | None = None,
    ) -> None:
        """Отписаться от события.

        Args:
            event_type: Тип события.
            handler:    Конкретный обработчик (или все, если None).
        """
        # Через EventStore отписка не поддерживается SubscriptionHub (no-op)
        logger.warning(
            "off() not supported via EventStore — handler may remain active"
        )

    def emit(self, event: DecisionEvent) -> None:
        """Опубликовать событие.

        Args:
            event: Событие для публикации.
        """
        stored = self._to_stored(event)
        self._store.publish_sync(stored)

    def clear(self) -> None:
        """Удалить всех подписчиков."""
        logger.warning("clear() not fully supported via EventStore")

    def _to_stored(self, event: DecisionEvent) -> StoredEvent:
        """Конвертировать DecisionEvent → StoredEvent."""
        return StoredEvent.new(
            aggregate=AGGREGATE_DECISION,
            aggregate_id=f"decision#{event.data.get('id', 'unknown')}",
            topic=f"decision.{event.type.value}",
            timestamp=event.timestamp or None,
            source=event.source,
            correlation_id=event.data.get("correlation_id", ""),
            causation_id=event.data.get("causation_id", ""),
            payload=json.dumps(event.to_dict()).encode("utf-8"),
            metadata={
                "event_type": event.type.value,
                "source": event.source,
                "category": "decision",
            },
        )


def _stored_to_decision_event(stored: StoredEvent) -> DecisionEvent:
    """Конвертировать StoredEvent → DecisionEvent."""
    raw = json.loads(stored.payload.decode("utf-8"))
    return DecisionEvent(
        type=DecisionEventType(raw.get("type", "")),
        timestamp=raw.get("timestamp", stored.timestamp),
        data=raw.get("data", {}),
        source=raw.get("source", stored.source),
    )


# ═══════════════════════════════════════════════════════════════════
#  Event Factory Helpers
# ═══════════════════════════════════════════════════════════════════


def opportunity_created_event(opportunity: Opportunity) -> DecisionEvent:
    """Создать событие OPPORTUNITY_CREATED."""
    return DecisionEvent(
        type=DecisionEventType.OPPORTUNITY_CREATED,
        data={
            "opportunity": opportunity.to_dict(),
            "id": opportunity.id,
            "direction": opportunity.direction.value,
            "confidence": opportunity.confidence,
            "strategies": opportunity.strategies,
        },
    )


def opportunity_rejected_event(
    opportunity: Opportunity,
    reason: str,
) -> DecisionEvent:
    """Создать событие OPPORTUNITY_REJECTED."""
    return DecisionEvent(
        type=DecisionEventType.OPPORTUNITY_REJECTED,
        data={
            "opportunity": opportunity.to_dict(),
            "id": opportunity.id,
            "reason": reason,
            "direction": opportunity.direction.value,
            "confidence": opportunity.confidence,
        },
    )


def conflict_detected_event(
    signals: list,
    consensus: Any,
) -> DecisionEvent:
    """Создать событие CONFLICT_DETECTED."""
    return DecisionEvent(
        type=DecisionEventType.CONFLICT_DETECTED,
        data={
            "num_signals": len(signals),
            "conflict_type": consensus.conflict_type.value if consensus.conflict_type else None,
            "details": consensus.details,
            "participating": consensus.participating,
        },
    )


def consensus_changed_event(
    old: Any,
    new: Any,
) -> DecisionEvent:
    """Создать событие CONSENSUS_CHANGED."""
    return DecisionEvent(
        type=DecisionEventType.CONSENSUS_CHANGED,
        data={
            "old_direction": old.direction.value if old else None,
            "new_direction": new.direction.value,
            "old_confidence": old.confidence if old else 0.0,
            "new_confidence": new.confidence,
            "participating": new.participating,
        },
    )


def decision_taken_event(
    opportunity: Opportunity,
    decision: str,
) -> DecisionEvent:
    """Создать событие DECISION_TAKEN."""
    return DecisionEvent(
        type=DecisionEventType.DECISION_TAKEN,
        data={
            "opportunity_id": opportunity.id,
            "direction": opportunity.direction.value,
            "decision": decision,
            "confidence": opportunity.confidence,
            "symbol": opportunity.symbol,
        },
    )
