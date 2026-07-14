# Roadmap — Trading Platform

> **Current:** v1.0 ✅ — **Initial Stable Release**
> **Next:** **Generation 2** — Runtime API
> **Status:** 🎉 v1.0 released on 2026-07-14

---

## Generation 1: v1.0 ✅ — Trading Platform Initial Stable Release

After 16 pre-release cycles, the platform reached its first stable milestone.

### Accomplished

- **Core Stabilized**: Event Store, PluginRegistry, Replay Engine, Decision Engine, Learning Engine, Marketplace
- **API Frozen**: `core`, `workspace`, `screener_sdk`, `marketplace` — no breaking changes without RFC
- **Workspace Complete**: 8 apps (Scanner, Inspector, Replay Studio, Strategy Monitor, Plugin Store, Learning Hub, System Monitor, Command Palette), 10 architectural layers
- **Workspace SDK**: `registerCommand`, `registerSearchAdapter`, `registerPanel`, `pushTimelineEvent`
- **953+ tests**, Performance Baseline, API audit, import audit, long-running stress
- **Documentation**: 7 guides, API reference, sequence diagrams, 7 examples

### v1.0.x — Bugfix Releases

Bugfix releases as needed — no new features, only fixes based on user reports.

---

## Generation 2: Runtime API 🔄

The major architectural shift. Workspace transitions from monolithic application to **one of many clients** of the Runtime.

```
Workspace ─┐
Trading Lab─┼── Runtime API ── Event Store
Marketplace┘         │
                     ├── Binance
                     ├── Bybit
                     ├── OKX
                     └── Coinbase
```

### Epics

| Epic | Description |
|------|-------------|
| **Runtime API** | Service layer that owns all domain logic. Workspace, CLI, and future clients call Runtime via a clean API boundary |
| **Multi-Exchange** | Exchange runtime adapters (Binance, Bybit, OKX). Unified order management, position tracking, balance aggregation |
| **Marketplace Cloud** | Remote package registry, sync between instances, publishing workflow, version management |
| **Plugin SDK 2.0** | Cross-exchange strategies, Runtime-aware plugins, lifecycle hooks |

### Why Workspace becomes a client

Today Workspace embeds the engine directly (FastAPI imports `core`). In Gen 2:

- **Runtime** is a standalone process/service
- **Workspace** connects to Runtime via WebSocket / REST
- **Trading Lab** connects to Runtime via gRPC / shared bus
- **CLI** connects to Runtime via the same API surface

This enables: independent scaling, hot-restart of UI without affecting engine, remote deployment (UI on cloud, engine on VPS), and third-party clients.

---

## Generation 3: Simulation Lab

| Feature | Description |
|---------|-------------|
| Monte Carlo | Multi-year simulations with randomized parameters |
| Walk-forward | Rolling window optimization + out-of-sample validation |
| Portfolio Simulation | Multi-asset, multi-strategy P&L aggregation |
| Distributed Compute | Parallel backtesting across worker pool |

---

## Version History

| Version | Date | What |
|---------|------|------|
| v0.5.0 | — | Initial |
| v0.6.0 | — | Replay, Quality, Analytics |
| v0.14.0 | 2026-07-13 | Event Store, Aggregate Streams |
| v0.15.0 | 2026-07-14 | Stabilisation — API audit, boundaries, hardening |
| v0.16.0-rc1 | 2026-07-14 | Release Candidate Cycle |
| **v1.0.0** | **2026-07-14** | **Initial Stable Release 🎉** |
