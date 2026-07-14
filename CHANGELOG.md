# Changelog

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
