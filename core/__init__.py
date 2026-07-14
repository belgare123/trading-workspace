"""Core package — ядро Trading Workspace Platform."""

from __future__ import annotations

# ── Legacy API (будет удалён в v2.0) ──
from core.api import Event, MarketDataBus, SignalResult, get_bus

# ── Event Store (P0.3–P0.5) ──
from core.event_store import (
    EventStore,
    StoredEvent,
    SQLiteEventRepository,
    EventPublisher,
    SubscriptionHub,
    TraceNode,
    TraceGraph,
    TraceBuilder,
    trace_by_correlation,
    trace_event,
    AggregateStream,
    AggregateRepository,
    ConcurrencyError,
)

# ── Engines ──
from core.decision import DecisionEngine
from core.decision.events import EventBus as DecisionEventBus
from core.analytics import AnalyticsEngine
from core.quality import QualityEngine
from core.portfolio import PortfolioEngine
from core.lifecycle import LifecycleEngine
from core.replay import ReplayEngine
from core.learning import LearningEngine
from core.signal import SignalEngine
from core.consensus import ConsensusEngine
from core.ome import OME

# ── Strategy Platform ──
from core.strategy import (
    StrategyEngine,
    BaseStrategy,
    IStrategy,
    Signal,
    SignalBundle,
    SignalDirection,
    PluginRegistry,
    PluginRecord,
    PluginRegistryError,
    PluginLoader,
    PluginInfo,
    StrategyContext,
    StrategyConfig,
)

# ── App / Services ──
from core.app import Application, run_app, bootstrap_app
from core.services import IService, ServiceRuntime

from core.di import Container

__version__ = "0.15.0"

__all__ = [
    # Legacy API
    "Event",
    "MarketDataBus",
    "SignalResult",
    "get_bus",
    # Event Store
    "EventStore",
    "StoredEvent",
    "SQLiteEventRepository",
    "EventPublisher",
    "SubscriptionHub",
    "TraceNode",
    "TraceGraph",
    "TraceBuilder",
    "trace_by_correlation",
    "trace_event",
    "AggregateStream",
    "AggregateRepository",
    "ConcurrencyError",
    # Engines
    "DecisionEngine",
    "DecisionEventBus",
    "AnalyticsEngine",
    "QualityEngine",
    "PortfolioEngine",
    "LifecycleEngine",
    "ReplayEngine",
    "LearningEngine",
    "SignalEngine",
    "ConsensusEngine",
    # OME
    "OME",
    # Strategy Platform
    "StrategyEngine",
    "BaseStrategy",
    "IStrategy",
    "Signal",
    "SignalBundle",
    "SignalDirection",
    "PluginRegistry",
    "PluginRecord",
    "PluginRegistryError",
    "PluginLoader",
    "PluginInfo",
    "StrategyContext",
    "StrategyConfig",
    # App / Services
    "Application",
    "run_app",
    "bootstrap_app",
    "IService",
    "ServiceRuntime",
    "Container",
    # Version
    "__version__",
]
