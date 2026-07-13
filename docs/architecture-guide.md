# Trading Workspace — Architecture Guide

## Overview

Trading Workspace is a modular algorithmic trading platform built around a **pipeline architecture** with three nested systems:

1. **Core Engine** — real-time market data processing, signal generation, decision making
2. **Workspace UI** — web dashboard (FastAPI) with plugin management, strategy monitoring, and analytics
3. **Marketplace** — plugin registry, package manager, trust system, and community layer

```
┌──────────────────────────────────────────────────────────┐
│                     Workspace UI                          │
│  (FastAPI + Jinja2 — monitoring, store, settings)        │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTP / WebSocket
┌────────────────────▼─────────────────────────────────────┐
│                      Core Engine                          │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Data    │→ │ Feature  │→ │ Strategy │→ │ Decision │ │
│  │  Layer   │  │ Engine   │  │ Engine   │  │ Engine   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│       │              │              │              │      │
│       ▼              ▼              ▼              ▼      │
│  ┌───────────────────────────────────────────────────┐   │
│  │         Lifecycle + Replay + Quality + Portfolio   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  ┌───────────────────────────────────────────────────┐   │
│  │    Learning Engine (ML/AI — detection, training)   │   │
│  └───────────────────────────────────────────────────┘   │
└────────────────────┬─────────────────────────────────────┘
                     │ API
┌────────────────────▼─────────────────────────────────────┐
│                      Marketplace                          │
│  (Registry, Package Manager, Trust System, Community)     │
└──────────────────────────────────────────────────────────┘
```

## Core Architecture

### Data Flow

```
Exchange (WebSocket)
     │
     ▼
DataEngine (normalizes exchange data)
     │
     ▼
CandleStore / TickerStore / OBStore (staged storage)
     │
     ▼
FeatureEngine (computes technical indicators)
     │
     ▼
StrategyContext (per-symbol market state)
     │
     ▼
Strategy.signals() → SignalBundle
     │
     ▼
DecisionEngine (consensus + confidence + policy)
     │
     ▼
OpportunityBuilder → LifecycleEngine → Execution
```

### Pipeline Stages

| Stage | Module | Responsibility |
|-------|--------|----------------|
| **Data Ingestion** | `exchanges/` | WebSocket streams from exchanges |
| **Normalization** | `core/exchanges/` | Unified data format regardless of exchange |
| **Feature Computation** | `core/features/` | Technical indicators, market profile, session analysis |
| **Feature Storage** | `core/storage/` | Time-series storage (candles, tickers, order books) |
| **Strategy Execution** | `core/strategy/` | User-defined strategies produce SignalBundle |
| **Decision Making** | `core/decision/` | Consensus, conflict resolution, confidence scoring |
| **Opportunity Lifecycle** | `core/lifecycle/` | Order lifecycles, entry monitoring, stop-loss tracking |
| **Market Replay** | `core/replay/` | Historical backtesting with event sourcing |
| **Quality Assessment** | `core/quality/` | Signal quality scoring, ranking |
| **Analytics** | `core/analytics/` | Market regime detection, volatility analysis |
| **Portfolio** | `core/portfolio/` | Position sizing, risk allocation |
| **Learning** | `core/learning/` | ML model training, signal prediction, anomaly detection |

### DI Container

All major components are registered in `core/di/container.py` and wired in `core/app/bootstrap.py`.

Components are registered by string name:
```python
container.register_instance("feature_engine", fe)
container.register_instance("strategy_engine", se)
```

Resolved via:
```python
fe = container.get("feature_engine")
```

### Event Bus

Components communicate via `core/decision/events.py` (EventBus) — a pub/sub system:

```python
bus = EventBus()
bus.subscribe("opportunity", handler)
bus.publish(OpportunityEvent(...))
```

Events flow through: Strategy → Decision → Lifecycle → Replay → Quality → Analytics → Learning

## Module Map

### `core/strategy/` — Strategy SDK

The heart of the platform. Everything a strategy author needs:

| File | Purpose |
|------|---------|
| `base.py` | `BaseStrategy` — abstract base for all strategies |
| `engine.py` | `StrategyEngine` — lifecycle manager for strategies |
| `context.py` | `StrategyContext` — per-symbol market state provided to strategies |
| `signal.py` | `Signal`, `SignalBundle`, `SignalDirection` — output models |
| `descriptor.py` | `StrategyDescriptor` — metadata, manifest parsing |
| `discovery.py` | `DiscoveryEngine` — finds and loads strategies from directories |
| `plugin_registry.py` | `PluginRegistry` — installed package management |
| `repository.py` | `PluginRepository` — install/update/remove from sources |
| `dependency.py` | `DependencyResolver` — SemVer resolution, cycle detection |
| `sandbox.py` | `SandboxManager` — isolated execution environment |
| `feature_graph.py` | `FeatureGraph` — DAG of required features per strategy |
| `validator.py` | `StrategyValidator` — pre-execution validation |
| `protocol.py` | Protocol interfaces for DI |

### `core/decision/` — Decision Engine

| File | Purpose |
|------|---------|
| `engine.py` | `DecisionEngine` — orchestrates the pipeline |
| `consensus.py` | `ConsensusEngine` — signal aggregation + conflict resolution |
| `confidence.py` | `ConfidenceEngine` — confidence scoring |
| `normalizer.py` | Signal normalization into `NormalizedSignal` |
| `policy.py` | Policy rules (cooldowns, filters) |
| `weighting.py` | Strategy weight engine (winrate-based) |
| `opportunity.py` | `OpportunityBuilder` — builds tradable opportunities |
| `events.py` | Event bus for pub/sub communication |
| `models.py` | Data types: `NormalizedSignal`, `ConsensusResult`, `Opportunity` |

### `core/lifecycle/` — Opportunity Lifecycle

Tracks opportunities through 8 states: `created → approved → monitored → pending_entry → active → exit_pending → closed → archived`.

### `core/replay/` — Market Replay

Event-sourced replay engine for backtesting. Records market snapshots deterministically.

### `core/quality/` — Quality Engine

12 metrics for signal quality: consistency, timeliness, confidence, precision, completeness, relevance, originality, robustness, adaptiveness, interpretability, efficiency, satisfaction.

### `core/analytics/` — Analytics Engine

Market regime detection (trending, ranging, volatile, quiet), session analysis, liquidity zones, market profile.

### `core/portfolio/` — Portfolio Engine

Dynamic position sizing, risk allocation, correlation-aware weighting.

### `core/learning/` — Learning Engine

ML-based signal detection, classifier, trainer, optimizer, weight updater.

## Marketplace Architecture

### `marketplace/` — Plugin Ecosystem

| Component | Purpose |
|-----------|---------|
| `models.py` | Data types: `Package`, `PackageVersion`, `TrustLevel` |
| `registry.py` | `RegistryClient` — local/remote package index |
| `package_manager.py` | `PackageManager` — install/update/remove API |
| `cli.py` | `tw` CLI tool |
| `trust.py` | Trust levels + signature verification |
| `passport.py` | Strategy passport builder |
| `benchmark.py` | Benchmark repository for backtest results |
| `compatibility.py` | Pre-install compatibility checks |
| `channels.py` | Update channel management |

## Workspace Architecture

### `workspace/` — Web Dashboard

FastAPI application serving the Plugin Store, strategy monitoring, and system management:

```
workspace/
├── main.py           — FastAPI app, router registration
├── core/
│   ├── app_registry.py  — App/service registry
├── apps/
│   ├── api/          — System Status API
│   ├── plugins/      — Plugin Store UI
│   ├── strategies/   — Strategy management
│   ├── opportunities/— Opportunity monitoring
│   ├── replay/       — Replay controls
│   ├── scanner/      — Scanner console
│   ├── learning/     — ML training dashboard
│   ├── monitor/      — System monitoring
│   ├── inspector/    — Signal inspector
│   └── settings/     — Settings panel
├── templates/        — Jinja2 templates
└── static/           — CSS, JS assets
```

## SDK (Strategy Author Interface)

The public SDK is `screener_sdk/` — a thin re-export layer:

```python
from screener_sdk import (
    BaseStrategy,
    StrategyContext,
    Signal,
    SignalBundle,
)
```

Strategy authors should **never** import from `core.*` directly.

## Deployment

- **Runtime**: Windows, Python 3.11+
- **Exchanges**: Bybit (WebSocket), Binance, OKX
- **Storage**: In-memory stores with periodic persistence
- **Dashboard**: FastAPI on port 9120
- **Profiles**: Hermes profile with specific models per component

## Version

Current: **v0.15.0** (Phase 15 — Marketplace Platform)
Roadmap: v0.15.x → RC1 → RC2 → v1.0.0
