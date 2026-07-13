"""
Lifecycle Engine — Data Models (Phase 8).

Central entity: OpportunityState (10 states)
Position Model: Opportunity → Position → Trade
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  8.1 Opportunity State
# ═══════════════════════════════════════════════════════════════════


class OpportunityState(Enum):
    """10 состояний жизненного цикла торговой идеи."""
    CREATED = "created"
    VALIDATED = "validated"
    WAITING_ENTRY = "waiting_entry"
    ACTIVE = "active"
    PARTIAL_TARGET = "partial_target"
    FULL_TARGET = "full_target"
    STOPPED = "stopped"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    ARCHIVED = "archived"

    @classmethod
    def active_set(cls) -> set["OpportunityState"]:
        """Состояния, в которых Opportunity считается живой."""
        return {
            cls.CREATED,
            cls.VALIDATED,
            cls.WAITING_ENTRY,
            cls.ACTIVE,
            cls.PARTIAL_TARGET,
        }

    @classmethod
    def terminal_set(cls) -> set["OpportunityState"]:
        """Терминальные состояния (идея завершена)."""
        return {
            cls.FULL_TARGET,
            cls.STOPPED,
            cls.CANCELLED,
            cls.EXPIRED,
            cls.ARCHIVED,
        }


# ═══════════════════════════════════════════════════════════════════
#  8.9 Position Model
# ═══════════════════════════════════════════════════════════════════


@dataclass
class Position:
    """Открытая позиция — результат активации Opportunity.

    Attributes:
        id:                Уникальный ID позиции.
        opportunity_id:    ID родительской Opportunity.
        symbol:            Торговый инструмент.
        direction:         Направление (long/short).
        entry_price:       Цена входа.
        size:              Размер позиции (в базовой валюте).
        stop_loss:         Текущий стоп-лосс.
        targets:           Текущие целевые уровни.
        highest_price:     Максимальная цена с момента входа.
        lowest_price:      Минимальная цена с момента входа.
        opened_at:         Время открытия.
        closed_at:         Время закрытия (None если открыта).
        pnl:               Реализованный PnL (None если открыта).
        rr:                Реализованный RR (None если открыта).
    """
    opportunity_id: str
    symbol: str
    direction: str  # "long" or "short"
    entry_price: float
    size: float = 0.0
    stop_loss: float | None = None
    targets: list[float] = field(default_factory=list)
    highest_price: float = 0.0
    lowest_price: float = 0.0
    opened_at: float = 0.0
    closed_at: float | None = None
    pnl: float | None = None
    rr: float | None = None
    id: str = ""
    meta: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.id:
            self.id = f"pos_{uuid.uuid4().hex[:12]}"
        if self.opened_at == 0.0:
            self.opened_at = time.time()
        if self.highest_price == 0.0:
            self.highest_price = self.entry_price
        if self.lowest_price == 0.0:
            self.lowest_price = self.entry_price

    @property
    def is_open(self) -> bool:
        return self.closed_at is None

    @property
    def holding_time(self) -> float:
        """Время удержания в секундах."""
        end = self.closed_at or time.time()
        return end - self.opened_at

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "opportunity_id": self.opportunity_id,
            "symbol": self.symbol,
            "direction": self.direction,
            "entry_price": self.entry_price,
            "size": self.size,
            "stop_loss": self.stop_loss,
            "targets": self.targets,
            "highest_price": self.highest_price,
            "lowest_price": self.lowest_price,
            "opened_at": self.opened_at,
            "closed_at": self.closed_at,
            "pnl": self.pnl,
            "rr": self.rr,
            "is_open": self.is_open,
            "holding_time": self.holding_time,
        }


@dataclass
class Trade:
    """Завершённая сделка — финальный результат Position.

    Создаётся при закрытии позиции (STOPPED / FULL_TARGET).
    """
    position_id: str
    opportunity_id: str
    symbol: str
    direction: str
    entry_price: float
    exit_price: float
    size: float
    pnl: float
    pnl_pct: float
    rr: float
    reason: str  # "stop_loss" | "full_target" | "cancelled" | "expired"
    holding_time: float
    mfe: float = 0.0  # Max Favorable Excursion
    mae: float = 0.0  # Max Adverse Excursion
    opened_at: float = 0.0
    closed_at: float = 0.0
    id: str = ""
    meta: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.id:
            self.id = f"trade_{uuid.uuid4().hex[:12]}"
        if self.closed_at == 0.0:
            self.closed_at = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "position_id": self.position_id,
            "opportunity_id": self.opportunity_id,
            "symbol": self.symbol,
            "direction": self.direction,
            "entry_price": self.entry_price,
            "exit_price": self.exit_price,
            "size": self.size,
            "pnl": self.pnl,
            "pnl_pct": self.pnl_pct,
            "rr": self.rr,
            "reason": self.reason,
            "holding_time": self.holding_time,
            "mfe": self.mfe,
            "mae": self.mae,
            "opened_at": self.opened_at,
            "closed_at": self.closed_at,
        }


# ═══════════════════════════════════════════════════════════════════
#  8.7 Opportunity Journal Entry
# ═══════════════════════════════════════════════════════════════════


@dataclass
class JournalEntry:
    """Запись в журнале жизненного цикла Opportunity.

    Хронология изменений для Replay.
    """
    opportunity_id: str
    event_type: str  # "created", "entry", "target1", "stop_moved", "closed"
    timestamp: float = 0.0
    data: dict[str, Any] = field(default_factory=dict)
    id: str = ""

    def __post_init__(self) -> None:
        if not self.id:
            self.id = f"je_{uuid.uuid4().hex[:12]}"
        if self.timestamp == 0.0:
            self.timestamp = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "opportunity_id": self.opportunity_id,
            "event_type": self.event_type,
            "timestamp": self.timestamp,
            "data": self.data,
        }


# ═══════════════════════════════════════════════════════════════════
#  Opportunity Version
# ═══════════════════════════════════════════════════════════════════


@dataclass
class OpportunityVersion:
    """Версия Opportunity — снимок состояния в момент изменения.

    Позволяет отслеживать эволюцию торговой идеи.
    """
    opportunity_id: str
    version: int
    state: OpportunityState
    direction: str
    entry_price: float
    stop_loss: float | None = None
    targets: list[float] = field(default_factory=list)
    confidence: float = 0.0
    reason: str = ""
    timestamp: float = 0.0
    prev_version: int | None = None
    changes: dict[str, Any] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "opportunity_id": self.opportunity_id,
            "version": self.version,
            "state": self.state.value,
            "direction": self.direction,
            "entry_price": self.entry_price,
            "stop_loss": self.stop_loss,
            "targets": self.targets,
            "confidence": self.confidence,
            "reason": self.reason,
            "timestamp": self.timestamp,
            "prev_version": self.prev_version,
            "changes": self.changes,
        }


# ═══════════════════════════════════════════════════════════════════
#  8.8 Tracked Metrics (snapshot)
# ═══════════════════════════════════════════════════════════════════


@dataclass
class LifecycleMetrics:
    """Текущие метрики для активной позиции.

    Обновляются на каждом тике/баре.
    """
    opportunity_id: str
    current_rr: float = 0.0
    current_pnl: float = 0.0
    current_drawdown: float = 0.0
    highest_price: float = 0.0
    lowest_price: float = 0.0
    mfe: float = 0.0      # Max Favorable Excursion
    mae: float = 0.0      # Max Adverse Excursion
    time_alive: float = 0.0
    distance_to_stop: float = 0.0
    distance_to_target1: float = 0.0
    volatility: float = 0.0
    updated_at: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "current_rr": round(self.current_rr, 4),
            "current_pnl": round(self.current_pnl, 2),
            "current_drawdown": round(self.current_drawdown, 4),
            "highest_price": self.highest_price,
            "lowest_price": self.lowest_price,
            "mfe": round(self.mfe, 2),
            "mae": round(self.mae, 2),
            "time_alive": round(self.time_alive, 1),
            "distance_to_stop": round(self.distance_to_stop, 2),
            "distance_to_target1": round(self.distance_to_target1, 2),
            "volatility": round(self.volatility, 4),
        }
