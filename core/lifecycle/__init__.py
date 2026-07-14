"""
Lifecycle Engine (Phase 8) — управление жизненным циклом торговой идеи.

Opportunity → Lifecycle → Position → Trade

Модули:
  8.1  State Machine     — 10 состояний, валидация переходов
  8.2  Entry Monitor     — отслеживание входа
  8.3  Opportunity Tracker — текущее состояние позиции
  8.4  Stop/Target Monitor — стопы, тейки, trailing, BE
  8.5  Lifecycle Events  — типы событий
  8.6  Expiration Engine — TTL
  8.7  Opportunity Journal — хронология
  8.8  Lifecycle Metrics — MFE, MAE, RR, PnL
  8.9  Position Model    — Opportunity → Position → Trade
  8.10 Opportunity Bus   — отдельная шина событий
  +    Versioning        — версионирование Opportunity
"""

from __future__ import annotations

from core.lifecycle.bus import OpportunityBus
from core.lifecycle.engine import LifecycleContext, LifecycleEngine, LifecycleResult
from core.lifecycle.entry_monitor import EntryMonitor, EntryResult, EntryStatus
from core.lifecycle.events import LifecycleEvent, LifecycleEventType
from core.lifecycle.expiration import ExpirationEngine
from core.lifecycle.journal import OpportunityJournal
from core.lifecycle.metrics import FinalMetrics, MetricsCalculator
from core.lifecycle.models import (
    JournalEntry,
    LifecycleMetrics,
    OpportunityState,
    OpportunityVersion,
    Position,
    Trade,
)
from core.lifecycle.state_machine import StateMachine, TransitionError
from core.lifecycle.stop_target import StopTargetConfig, StopTargetEvent, StopTargetMonitor, StopTargetResult
from core.lifecycle.tracker import OpportunityTracker
from core.lifecycle.versioning import VersionTracker

__all__ = [
    "LifecycleEngine",
    "LifecycleContext",
    "LifecycleResult",
    "StateMachine",
    "EntryMonitor",
    "EntryResult",
    "EntryStatus",
    "OpportunityTracker",
    "StopTargetMonitor",
    "StopTargetConfig",
    "StopTargetEvent",
    "StopTargetResult",
    "ExpirationEngine",
    "OpportunityJournal",
    "MetricsCalculator",
    "FinalMetrics",
    "OpportunityBus",
    "VersionTracker",
    "OpportunityState",
    "Position",
    "Trade",
    "LifecycleEvent",
    "LifecycleEventType",
    "JournalEntry",
    "LifecycleMetrics",
    "TransitionError",
]
