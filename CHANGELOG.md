# Changelog

## [1.0.0] — 2026-07-14

### Trading Platform v1.0 — Initial Stable Release

After 16 pre-release cycles, the platform reaches its first stable milestone:
Core stabilized, Workspace complete, API frozen.

#### 🏗️ Platform (core)

- **Event Store** (P1): SQLite-backed persisted event journal, replay, trace graph
- **Aggregate Streams** (P0.5): versioned event streams with snapshot/restore
- **PluginRegistry**: unified plugin system, capability DAG, strategy lifecycle
- **Replay Engine**: deterministic timeline, recorder, breakpoint debugging
- **Decision Engine**: consensus-based opportunity lifecycle
- **Learning Engine**: regime classification, ML inference pipeline
- **Marketplace**: package registry, dependency resolution, CLI
- **API Freeze**: all 4 public domains frozen (`core`, `workspace`, `screener_sdk`, `marketplace`)

#### 🖥️ Workspace UI (React 19 + Vite + Tailwind v4)

- **Scanner**: live market data, pair filtering, momentum/volume indicators
- **Inspector**: real-time signal graph, strategy state, trace visualization
- **Replay Studio**: timeline scrubber, event replay, step-through debug
- **Strategy Monitor**: active strategies, position tracking, P&L
- **Plugin Store**: install/update/remove marketplace packages from UI
- **Learning Hub**: ML training dashboard, regime chart, anomaly feed
- **System Monitor**: resource usage, event throughput, live process tree

#### Workspace Architecture

- **Design System**: typography, color tokens, spacing, component library
- **Notifications**: toast stack, badge counter, history, categories
- **Realtime Runtime**: WebSocket-driven stream channels, auto-reconnect
- **Timeline**: global event timeline, real-time feed, filter by channel
- **Command Palette**: keyboard-driven commands, fuzzy search, history
- **Federated Search**: cross-domain search (strategies, plugins, events, docs)
- **Layout System**: multi-panel, layout switcher, saved layouts, responsive
- **Loading UX**: skeleton screens, async boundaries, error recovery
- **Feature Flags**: typed toggle system with localStorage overrides
- **Telemetry Hooks**: no-op analytics emitter, 12 typed event points
- **Workspace SDK**: plugin API — `registerCommand`, `registerSearchAdapter`, `registerPanel`, `pushTimelineEvent`

#### 📦 Engineering

- **953+ tests** across all modules
- **Performance Baseline**: 5 metrics (event append, batch, replay, aggregate, trace)
- **Long-running stress**: 12h concurrency, 1M+ events, WAL checkpoint
- **API audit**: 228 files, 3 cross-domain violations fixed
- **Import audit**: zero circular imports
- **Documentation**: 7 guides + API reference + sequence diagrams + examples
- **License**: MIT

---

## [0.16.0-rc1] — 2026-07-14

### Release Candidate Cycle — начало
v0.16.x — RC Cycle перед v1.0. API Freeze, Performance Baseline, документация, демо.

#### Added
- **API Freeze**: public API frozen для `core`, `workspace`, `screener_sdk`, `marketplace`
- **Performance Baseline**: скрипт `scripts/performance_baseline.py`, baseline JSON в `docs/`
- **Event Store Guide**: `docs/event-store-guide.md` — полное описание Event Store API
- **Trace Demo**: `examples/trace_demo/run.py` — построение TraceGraph из chain событий
- **Marketplace Demo**: обновлён с корректными моделями Package/PackageVersion

#### Changed
- **release-roadmap.md**: переписан под новый план (RC Cycle → v1.0 → Multi-Exchange → Cloud → Ecosystem → Simulation Lab)
- **README.md**: v0.15.0 → v0.16.0-rc1
- **core.__version__**: 0.15.0 → 0.16.0
- **pyproject.toml**: 0.15.0 → 0.16.0

---

## [0.15.0] — 2026-07-14

### Stabilisation Phase — Complete
Public API audit, import boundary audit, hardening (indexes, retention, stress).

#### Added
- **Event Store indexes**: `idx_events_agg_ver` on `(aggregate, aggregate_id, aggregate_version)`, `idx_snapshots_ts` on `(timestamp)` for snapshot cleanup
- **Snapshot retention policy**: `AggregateRepository.cleanup_snapshots(max_age_days)` — age-based cleanup of stale snapshots
- **Concurrency stress tests** (5 tests): 100 concurrent publish (different + same aggregate), 100 concurrent read, 50+50 mixed load
- **Replay stress tests** (9 tests): Timeline ×1000 events, Engine ×1000, Recorder ×1000
- **Import boundary audit**: automated AST scan across 228 files, 3 cross-domain violations fixed

#### Changed
- **Public API cleanup**: `core/__init__.py` now exports 47 symbols; all subpackage `__all__` reviewed and corrected
- **Phase import path**: `core/services/base.py`, `core/strategy/base.py`, `core/strategy/engine.py` import `Phase` from `core.di` instead of `core.app.phases`
- **Mock API classes**: removed from `core.strategy.__all__`, test imports updated to `core.strategy.mocks`
- **pyproject.toml**: version synced to `0.15.0`

#### Fixed
- `from core import *` now works without `AttributeError`
- Mock classes no longer leak through the public API surface
- `strategy → app` and `services → app` import violations eliminated

---

## [0.14.0] — 2026-07-13

### Event Store & Aggregate Streams (P1, P0.4, P0.5)

#### Added
- **Event Store (P1)**: persisted SQLite-backed event journal with sync/async publish, ordering, versioning
- **7 Bus adapters**: thin facades over EventStore (LearningBus, LifecycleBus, StateBus, etc.)
- **EventStoreReader**: query by topic, aggregate, correlation, time range; cursor/pagination
- **Correlation & Trace API (P0.4)**: `TraceNode`, `TraceGraph`, `TraceBuilder` — event graph traversal by correlation_id or event_id
- **Aggregate Streams (P0.5)**: `AggregateStream` (versioned event stream, replay, snapshot), `AggregateRepository` (load/append/snapshot/restore), `ConcurrencyError`

#### Changed
- Replay engine fully integrated with EventStore
- All tests use in-memory SQLite DB for isolation

---

## [0.13.0] — 2026-07-12

### PluginRegistry & Legacy Cleanup

#### Added
- **PluginRegistry** — merged from StrategyRegistry, single source of truth for all plugins
- **Capability DAG** — feature graph for plugin dependency resolution
- `core.di` — dependency injection container re-exporting `Phase` and other neutral types
- Domain audit documentation (`docs/domain-audit.md`)

#### Removed
- Legacy `core/engine` module fully deleted
- Legacy `interfaces.py` and deprecated `Decision` module
- Dead directories: `bot/`, `dashboard/`
- `legacy` package removed

#### Changed
- StrategyEngine refactored into thin facade: `PluginLoader`, `StrategyRegistry`, `StrategyRunner`, `StrategyScheduler`, `StrategyLifecycle`
- Engine pipeline now flows through PluginRegistry for all plugins
- Feature freeze activated — no new subsystems until v1.0
