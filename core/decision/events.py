"""
Decision Events (7.8) — система событий Decision Engine.

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

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable

from core.decision.models import DecisionEventType, Opportunity, ConflictType

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
#  EventBus
# ═══════════════════════════════════════════════════════════════════


class EventBus:
    """Простая шина событий (pub/sub).

    Позволяет подписчикам получать события без прямой зависимости
    от Decision Engine.

    Usage:
        bus = EventBus()

        # Подписка
        bus.on(DecisionEventType.OPPORTUNITY_CREATED, my_handler)

        # Публикация
        bus.emit(event)
    """

    def __init__(self) -> None:
        self._handlers: dict[DecisionEventType, list[EventHandler]] = {
            t: [] for t in DecisionEventType
        }

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
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
        logger.debug("Subscribed handler for %s", event_type.value)

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
        if handler:
            if handler in self._handlers.get(event_type, []):
                self._handlers[event_type].remove(handler)
        else:
            self._handlers[event_type] = []

    def emit(self, event: DecisionEvent) -> None:
        """Опубликовать событие.

        Args:
            event: Событие для публикации.
        """
        handlers = self._handlers.get(event.type, [])
        for handler in handlers:
            try:
                handler(event)
            except Exception:
                logger.exception(
                    "Handler error for event %s", event.type.value
                )
        logger.debug("Emitted %s to %d handler(s)", event.type.value, len(handlers))

    def clear(self) -> None:
        """Удалить всех подписчиков."""
        self._handlers = {t: [] for t in DecisionEventType}


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
