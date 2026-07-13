"""
8.5 Lifecycle Events — события жизненного цикла Opportunity.

События публикуются в Opportunity Bus (8.10),
на них подписываются Replay, Quality, Dashboard, Learning.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable

from core.lifecycle.models import (
    JournalEntry,
    LifecycleMetrics,
    OpportunityState,
    Position,
    Trade,
)

logger = logging.getLogger(__name__)


class LifecycleEventType(Enum):
    """Типы событий жизненного цикла."""
    OPPORTUNITY_CREATED = "opportunity_created"
    OPPORTUNITY_ACTIVATED = "opportunity_activated"
    OPPORTUNITY_VALIDATED = "opportunity_validated"
    OPPORTUNITY_WAITING = "opportunity_waiting"
    OPPORTUNITY_UPDATED = "opportunity_updated"
    OPPORTUNITY_TARGET = "opportunity_target"
    OPPORTUNITY_STOPPED = "opportunity_stopped"
    OPPORTUNITY_EXPIRED = "opportunity_expired"
    OPPORTUNITY_CANCELLED = "opportunity_cancelled"
    OPPORTUNITY_ARCHIVED = "opportunity_archived"
    POSITION_OPENED = "position_opened"
    POSITION_UPDATED = "position_updated"
    POSITION_CLOSED = "position_closed"
    TRADE_CLOSED = "trade_closed"
    METRICS_UPDATED = "metrics_updated"


@dataclass
class LifecycleEvent:
    """Событие жизненного цикла."""
    type: LifecycleEventType
    opportunity_id: str
    state: OpportunityState | None = None
    position: Position | None = None
    trade: Trade | None = None
    metrics: LifecycleMetrics | None = None
    data: dict[str, Any] = field(default_factory=dict)
    source: str = "lifecycle_engine"
    timestamp: float = 0.0

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type.value,
            "opportunity_id": self.opportunity_id,
            "state": self.state.value if self.state else None,
            "position": self.position.to_dict() if self.position else None,
            "trade": self.trade.to_dict() if self.trade else None,
            "metrics": self.metrics.to_dict() if self.metrics else None,
            "data": self.data,
            "source": self.source,
            "timestamp": self.timestamp,
        }


EventHandler = Callable[["LifecycleEvent"], None]
