"""
Market Replay Framework — Phase 9.

Последняя инфраструктурная фаза перед построением интеллекта.

Компоненты:
  9.1  Data Source Abstraction — MarketSource / LiveSource / ReplaySource
  9.2  Replay Timeline — временная шкала событий
  9.3  Multi-Stream — Candles, Trades, Ticker, Liquidations, OB, Funding, OI
  9.4  Speed Controller — 0.25x ... ∞
  9.5  Pause / Resume — остановка и возобновление
  9.6  Seek — jump к timestamp
  9.7  Deterministic Replay — воспроизводимость
  9.8  Replay Recorder — запись live → .market
  9.9  .market Package — manifest + events.bin + checksum
  9.10 Validation — регрессионное тестирование
  ───  Snapshot Engine — снимки состояния
  ───  Replay Debugger — инспекция в реальном времени
"""

from __future__ import annotations

from core.replay.bus import ReplayBus, REPLAY_STARTED, REPLAY_STOPPED, REPLAY_EVENT
from core.replay.controller import ReplayController
from core.replay.debugger import ReplayDebugger, DebugInspectResult
from core.replay.deterministic import DeterministicExecutor, DeterministicHash
from core.replay.engine import ReplayEngine
from core.replay.models import (
    ReplayEvent,
    ReplayManifest,
    ReplayPackage,
    ReplaySnapshot,
    ReplayStreamType,
    ReplayContext,
    SeekTarget,
    ValidationResult,
)
from core.replay.package import PackageWriter, PackageReader
from core.replay.recorder import ReplayRecorder
from core.replay.snapshot import SnapshotEngine
from core.replay.source import MarketSource, LiveSource, ReplaySource
from core.replay.speed import SpeedController, SpeedMultiplier
from core.replay.streams import (
    generate_demo_events,
    make_candle_event,
    make_trade_event,
    make_ticker_event,
    make_liquidation_event,
    make_orderbook_event,
    make_funding_event,
    make_open_interest_event,
)
from core.replay.timeline import Timeline, TimelineState
from core.replay.validation import ValidationEngine

__all__ = [
    "ReplayEngine",
    "ReplayBus",
    "ReplayController",
    "ReplayDebugger",
    "DeterministicExecutor",
    "Timeline",
    "SpeedController",
    "ReplayRecorder",
    "PackageWriter",
    "PackageReader",
    "ValidationEngine",
    "SnapshotEngine",
    "LiveSource",
    "ReplaySource",
    "MarketSource",
    "generate_demo_events",
    "make_candle_event",
    "make_trade_event",
    "make_ticker_event",
    "make_liquidation_event",
    "make_orderbook_event",
    "make_funding_event",
    "make_open_interest_event",
    # Models
    "ReplayEvent",
    "ReplayManifest",
    "ReplayPackage",
    "ReplaySnapshot",
    "ReplayStreamType",
    "ReplayContext",
    "SeekTarget",
    "ValidationResult",
    "DebugInspectResult",
    "TimelineState",
    "DeterministicHash",
    "SpeedMultiplier",
    # Constants
    "REPLAY_STARTED",
    "REPLAY_STOPPED",
    "REPLAY_EVENT",
]
