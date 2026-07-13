"""
Market Replay Framework — Data Models (Phase 9).

Core event types for multi-stream replay:
  - CandleEvent, TradeEvent, TickerEvent
  - LiquidationEvent, OrderBookEvent
  - FundingEvent, OpenInterestEvent

Package format for .market files.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  Replay Stream Types
# ═══════════════════════════════════════════════════════════════════


class ReplayStreamType(Enum):
    """Типы потоков данных для replay."""
    CANDLE = "candle"
    TRADE = "trade"
    TICKER = "ticker"
    LIQUIDATION = "liquidation"
    ORDER_BOOK = "order_book"
    FUNDING = "funding"
    OPEN_INTEREST = "open_interest"


@dataclass
class ReplayEvent:
    """Одно событие на временной шкале replay.

    Все события имеют единый формат:
      - timestamp: когда произошло
      - stream: тип потока
      - symbol: инструмент
      - data: payload события
    """
    timestamp: float
    stream: ReplayStreamType | str
    symbol: str
    data: dict[str, Any]
    id: str = ""

    def __post_init__(self) -> None:
        if not self.id:
            self.id = f"re_{uuid.uuid4().hex[:12]}"
        if isinstance(self.stream, str):
            try:
                self.stream = ReplayStreamType(self.stream)
            except ValueError:
                pass

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "stream": self.stream.value if isinstance(self.stream, ReplayStreamType) else self.stream,
            "symbol": self.symbol,
            "data": self.data,
        }


# ═══════════════════════════════════════════════════════════════════
#  Replay Package (.market)
# ═══════════════════════════════════════════════════════════════════


@dataclass
class ReplayManifest:
    """Манифест .market-пакета."""
    version: str = "1.0.0"
    name: str = ""
    description: str = ""
    created_at: float = 0.0
    symbols: list[str] = field(default_factory=list)
    streams: list[str] = field(default_factory=list)
    start_time: float = 0.0
    end_time: float = 0.0
    event_count: int = 0
    checksum: str = ""  # SHA256 от events.bin
    meta: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.created_at == 0.0:
            self.created_at = time.time()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ReplayPackage:
    """Готовый .market-пакет (загруженный в память)."""
    manifest: ReplayManifest
    events: list[ReplayEvent]
    metadata: dict[str, Any] = field(default_factory=dict)
    path: str = ""

    @property
    def duration(self) -> float:
        return self.manifest.end_time - self.manifest.start_time

    @property
    def event_count(self) -> int:
        return len(self.events)

    def get_events(
        self,
        stream: ReplayStreamType | str | None = None,
        symbol: str | None = None,
        start_time: float | None = None,
        end_time: float | None = None,
    ) -> list[ReplayEvent]:
        """Фильтровать события по параметрам."""
        results = self.events
        if stream:
            stream_val = stream.value if isinstance(stream, ReplayStreamType) else stream
            results = [e for e in results if e.stream == stream_val or (isinstance(e.stream, ReplayStreamType) and e.stream.value == stream_val)]
        if symbol:
            results = [e for e in results if e.symbol == symbol]
        if start_time is not None:
            results = [e for e in results if e.timestamp >= start_time]
        if end_time is not None:
            results = [e for e in results if e.timestamp <= end_time]
        return results


# ═══════════════════════════════════════════════════════════════════
#  Snapshot Models
# ═══════════════════════════════════════════════════════════════════


@dataclass
class ReplaySnapshot:
    """Снимок состояния в момент времени."""
    frame: int
    timestamp: float
    label: str = ""
    feature_graph_state: dict[str, Any] = field(default_factory=dict)
    decision_context: dict[str, Any] = field(default_factory=dict)
    lifecycle_context: dict[str, Any] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SeekTarget:
    """Цель для jump/seek."""
    timestamp: float
    tolerance: float = 1.0  # секунд


# ═══════════════════════════════════════════════════════════════════
#  Validation Result
# ═══════════════════════════════════════════════════════════════════


@dataclass
class ValidationResult:
    """Результат валидации replay."""
    passed: bool
    replay_id: str
    signals_match: bool = True
    decisions_match: bool = True
    lifecycle_match: bool = True
    metrics_match: bool = True
    mismatch_details: list[str] = field(default_factory=list)
    signal_count: int = 0
    decision_count: int = 0
    lifecycle_count: int = 0
    score: float = 0.0

    @property
    def summary(self) -> str:
        parts = [f"Replay {self.replay_id}: {'PASS' if self.passed else 'FAIL'}"]
        if not self.signals_match:
            parts.append("Signals MISMATCH")
        if not self.decisions_match:
            parts.append("Decisions MISMATCH")
        if not self.lifecycle_match:
            parts.append("Lifecycle MISMATCH")
        if not self.metrics_match:
            parts.append("Metrics MISMATCH")
        parts.append(f"Score: {self.score:.1%}")
        if self.mismatch_details:
            parts.append(f"Details: {self.mismatch_details[:3]}...")
        return " | ".join(parts)


# ═══════════════════════════════════════════════════════════════════
#  Replay Event Context
# ═══════════════════════════════════════════════════════════════════


@dataclass
class ReplayContext:
    """Контекст исполнения replay-сессии."""
    package: ReplayPackage
    current_index: int = 0
    current_timestamp: float = 0.0
    current_speed: float = 1.0
    is_paused: bool = False
    is_finished: bool = False
    snapshots: list[ReplaySnapshot] = field(default_factory=list)
    signals_generated: int = 0
    decisions_made: int = 0
    opportunities_created: int = 0
    trades_closed: int = 0
    meta: dict[str, Any] = field(default_factory=dict)
