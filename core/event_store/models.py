"""Event Store — domain models.

StoredEvent — универсальная транспортная обёртка для всех доменных событий.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any


# ── Aggregate & topic patterns ──

AGGREGATE_DECISION = "decision"
AGGREGATE_OPPORTUNITY = "opportunity"
AGGREGATE_MARKET = "market"
AGGREGATE_PORTFOLIO = "portfolio"
AGGREGATE_QUALITY = "quality"
AGGREGATE_LEARNING = "learning"
AGGREGATE_ANALYTICS = "analytics"
AGGREGATE_PORTFOLIO_EVENT = "portfolio_event"
AGGREGATE_PLATFORM = "platform"


# ── StoredEvent ──


@dataclass
class StoredEvent:
    """Персистентная обёртка доменного события.

    Метаданные — явные поля, не сериализуются в payload.
    Доменное событие лежит в ``payload`` как JSON-байты.

    Attributes:
        event_id:           UUID события.
        aggregate:          Доменная сущность ("opportunity", "decision"…).
        aggregate_id:       Идентификатор экземпляра ("opportunity#<uuid>").
        aggregate_version:  Версия агрегата (монотонный счётчик).
        topic:              Тип события ("opportunity.created").
        timestamp:          Время события (ms, float).
        correlation_id:     ID цепочки (все события одного pipeline).
        causation_id:       ID непосредственного родителя.
        source:             Компонент-отправитель ("DecisionEngine").
        payload:            JSON-сериализованный доменный Event.
        metadata:           Дополнительные служебные поля.
    """

    event_id: str
    aggregate: str
    aggregate_id: str
    aggregate_version: int
    topic: str
    timestamp: float
    correlation_id: str
    causation_id: str
    source: str
    payload: bytes = b""
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def new(
        cls,
        aggregate: str,
        aggregate_id: str,
        topic: str,
        correlation_id: str = "",
        causation_id: str = "",
        source: str = "",
        payload: bytes = b"",
        metadata: dict[str, Any] | None = None,
        timestamp: float | None = None,
        event_id: str | None = None,
        aggregate_version: int = 0,
    ) -> StoredEvent:
        """Удобный конструктор с автогенерацией UUID и timestamp."""
        import time

        return cls(
            event_id=event_id or str(uuid.uuid4()),
            aggregate=aggregate,
            aggregate_id=aggregate_id,
            aggregate_version=aggregate_version,
            topic=topic,
            timestamp=timestamp or (time.time() * 1000),
            correlation_id=correlation_id,
            causation_id=causation_id,
            source=source,
            payload=payload,
            metadata=metadata or {},
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_id": self.event_id,
            "aggregate": self.aggregate,
            "aggregate_id": self.aggregate_id,
            "aggregate_version": self.aggregate_version,
            "topic": self.topic,
            "timestamp": self.timestamp,
            "correlation_id": self.correlation_id,
            "causation_id": self.causation_id,
            "source": self.source,
            "payload": self.payload.decode("utf-8") if isinstance(self.payload, bytes) else self.payload,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> StoredEvent:
        payload = data.get("payload", b"")
        if isinstance(payload, str):
            payload = payload.encode("utf-8")
        return cls(
            event_id=data["event_id"],
            aggregate=data["aggregate"],
            aggregate_id=data["aggregate_id"],
            aggregate_version=data.get("aggregate_version", 0),
            topic=data["topic"],
            timestamp=data.get("timestamp", 0.0),
            correlation_id=data.get("correlation_id", ""),
            causation_id=data.get("causation_id", ""),
            source=data.get("source", ""),
            payload=payload,
            metadata=data.get("metadata", {}),
        )

    # ── Helpers for common aggregate IDs ──

    @staticmethod
    def make_opportunity_id(uid: str) -> str:
        return f"opportunity#{uid}"

    @staticmethod
    def make_market_id(symbol: str) -> str:
        return f"market#{symbol}"

    @staticmethod
    def make_portfolio_id(name: str = "default") -> str:
        return f"portfolio#{name}"

    @staticmethod
    def make_decision_id(uid: str) -> str:
        return f"decision#{uid}"

    @staticmethod
    def make_model_id(name: str) -> str:
        return f"model#{name}"


# ── Exceptions ──


class EventStoreError(Exception):
    """Базовое исключение Event Store."""


class EventNotFoundError(EventStoreError):
    """Событие не найдено."""


class EventStoreConnectionError(EventStoreError):
    """Ошибка подключения к хранилищу."""
