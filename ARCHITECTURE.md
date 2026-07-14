# Architecture Overview

> **v0.16.0-rc1** — Modular event-driven trading platform.

```
┌─────────────────────────────────────────────────────┐
│                    Workspace                         │
│  (FastAPI + WebSocket + Dashboard UI)               │
├─────────────────────────────────────────────────────┤
│                 Application Layer                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │  Engine   │ │ Services │ │      DI/App      │    │
│  └────┬─────┘ └──────────┘ └──────────────────┘    │
├───────┼─────────────────────────────────────────────┤
│       │           Engine Layer                       │
│  ┌────┴─────────────────────────────────────────┐   │
│  │  Strategy  — PluginLoader, PluginRegistry,   │   │
│  │              StrategyEngine, StrategyRunner    │   │
│  ├──────────────────────────────────────────────┤   │
│  │  Decision  — ConsensusEngine, DecisionEngine │   │
│  ├──────────────────────────────────────────────┤   │
│  │  Lifecycle — LifecycleEngine, OME, Positions │   │
│  ├──────────────────────────────────────────────┤   │
│  │  Replay    — Timeline, ReplayEngine,         │   │
│  │              Recorder, Replayer              │   │
│  ├──────────────────────────────────────────────┤   │
│  │  Event Store — SQLiteRepository, EventStore, │   │
│  │                TraceGraph, AggregateStreams  │   │
│  ├──────────────────────────────────────────────┤   │
│  │  Learning  — LearningEngine, Models          │   │
│  ├──────────────────────────────────────────────┤   │
│  │  Marketplace — Registry, PackageManager, CLI │   │
│  ├──────────────────────────────────────────────┤   │
│  │  Portfolio — PortfolioEngine, Positions      │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│                Infrastructure                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │  SQLite  │ │  Redis   │ │  Event Bus       │    │
│  │  (Event  │ │(optional)│ │ (7 adapters:     │    │
│  │   Store) │ │          │ │  Lifecycle,      │    │
│  │          │ │          │ │  Learning,       │    │
│  │          │ │          │ │  State, ...)     │    │
│  └──────────┘ └──────────┘ └──────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Event-Driven Architecture
The entire platform communicates through events. Every subsystem publishes
and subscribes via Event Bus adapters. This decouples producers from consumers
and makes the system inspectable (everything is logged to Event Store).

### 2. Event Store as Source of Truth
All state changes go through `EventStore` (SQLite-backed). This enables:
- **Replay**: reconstruct any past state
- **Trace**: follow correlation chains (signal → decision → order → fill)
- **Audit**: every mutation is recorded
- **Learning**: replay historical data for model training

### 3. Plugin Platform
Strategies and extensions are plugins loaded via `PluginLoader` and tracked
in `PluginRegistry` — the single source of truth for all plugins. Capability
DAG ensures dependency resolution.

### 4. Layers are Independent
Each Engine layer (Strategy → Decision → Lifecycle → Replay → Event Store)
has its own module with a clear public API. Cross-layer communication happens
only through events, never direct imports.

### 5. Thin Facades over Event Store
Legacy 7 Bus classes (LearningBus, LifecycleBus, etc.) are thin facades over
EventStore. They exist only for backward compatibility and will be removed in
v2.0.

## Module Architecture

| Layer | Package | Responsibility |
|-------|---------|---------------|
| **Engine** | `core.strategy` | Plugin loading, strategy lifecycle, scheduling |
| **Engine** | `core.decision` | Signal → opportunity → consensus → decision |
| **Engine** | `core.lifecycle` | Order management, position tracking |
| **Engine** | `core.replay` | Historical replay, timeline, recording |
| **Engine** | `core.event_store` | Persisted event journal, traces, aggregates |
| **Engine** | `core.learning` | Model training, inference |
| **Engine** | `marketplace` | Package registry, dependencies, CLI |
| **Engine** | `core.portfolio` | Portfolio P&L, risk |
| **Application** | `core.app` | Bootstrap, DI, services, lifecycle hooks |
| **Application** | `core.services` | Background tasks, health monitoring |
| **Application** | `core.di` | Dependency injection container |
| **Workspace** | `workspace/` | FastAPI, WebSocket, Dashboard |
| **SDK** | `screener_sdk/` | Plugin development SDK |

## Data Flow (Typical)

```
Market Data → Signal Engine → Strategy → Decision → Lifecycle → OME
                   │              │          │          │
                   └──────────────┴──────────┴──────────┘
                                      │
                                 Event Store
                                      │
                              ┌───────┴────────┐
                              │                 │
                           Replay           Learning
```

## Performance

| Metric | v0.15.0 Baseline |
|--------|-----------------|
| Event write | ~2,665 ev/s |
| Batch write (×100) | ~25,563 ev/s |
| Replay | ~2,118 ev/s |
| Aggregate restore | ~1,567 ops/s |
| Trace build | ~1,624 ops/s |

## Dependencies

- **Python 3.11+**
- **SQLite** (built-in, no external DB)
- **Marketplace**: `pip install trading-workspace`

Optional:
- Redis (for distributed caching in v1.2+)
- Docker (for workspace deployment)

## Roadmap

See [`docs/release-roadmap.md`](./docs/release-roadmap.md) for complete
version plan.
