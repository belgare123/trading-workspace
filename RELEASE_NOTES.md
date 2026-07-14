## 1.0.0 — Stable Release

**Release Candidate validation complete.** This is the first stable release of the Trading Workspace Platform.

### What's New Since v0.15.0

#### Architecture & API
- **API Freeze**: public API frozen for `core`, `workspace`, `screener_sdk`, `marketplace` — changes only through RFC until v2.0
- **Performance Baseline**: fixed metrics recorded (event_append ~2,665/s, batch_100 ~25,563/s, replay ~2,118/s, trace ~1,624/s)
- **Architecture docs**: `ARCHITECTURE.md` (1-page overview), `SUPPORT.md` (compatibility, lifecycle)
- **Event Store Guide**: `docs/event-store-guide.md` — full Event Store API documentation

#### Event Store & Traces
- **Event Store**: SQLite-backed persisted event journal with sync/async publish, ordering, versioning
- **7 Bus adapters**: thin facades over EventStore (LearningBus, LifecycleBus, StateBus, etc.)
- **Correlation & Trace API**: `TraceNode`, `TraceGraph`, `TraceBuilder` — event graph traversal by correlation_id or event_id
- **Aggregate Streams**: `AggregateStream` (versioned event stream, replay, snapshot), `AggregateRepository`

#### Packaging & Distribution
- **Wheel + sdist**: `pip install trading-workspace` — verified clean install from wheel
- **CLI**: `tw` with 10 commands (install, search, info, resolve, ...)
- **Clean environment**: 953 tests pass on fresh install in 3.70s

#### Validation
- **Packaging audit**: wheel/sdist build, clean install, imports, CLI — all green
- **Event Store validation**: 10K events, WAL checkpoint, VACUUM, reopen, restore, trace — all green
- **Long-running stress**: 12h pipeline run (in progress)
- **Scalability**: 953 test suite, concurrency tests (100 threads), replay stress (1000 events)

### Breaking Changes
- Public API frozen — no new subsystems until v1.1
- Legacy `core/engine` module removed (migrated to `core/strategy`)
- `core.legacy` package removed

### Full Changelog
v0.13.0 → v0.14.0 → v0.15.0 → v0.16.0-rc1 → v1.0.0

See [CHANGELOG.md](CHANGELOG.md) for detailed history.

---

**Next**: [v1.1 — Workspace UI 2.0 (React + TypeScript + Tailwind)](docs/release-roadmap.md)
