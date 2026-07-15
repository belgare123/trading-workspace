# Changelog

## Runtime Kernel v2.0.0 (2026-07-15)

Phase 2.4 Stabilization — complete platform overhaul of the Runtime Kernel.

### Added

**Sprint 2.4.1 — API Freeze**
- 9 service APIs: Market, Strategy, Portfolio, ML, Search, Notification, Replay, EventStore, Plugin
- API compatibility tests + snapshot capture

**Sprint 2.4.2 — EventBus Specification v1.0**
- `RuntimeEvent<T>` canonical interface with trace support
- Topic Convention (28 topics across market, plugin, system, strategy, etc.)
- Event Schema Registry for type-safe event dispatch
- Typed EventBus with `emit<T>` / `on<T>` generics
- Event Lifecycle pipeline: validate → middleware → bus → archive
- Express-style middleware chain
- Event Recorder with ring buffer and storage
- CorrelationId + causationId trace propagation

**Sprint 2.4.3 — Runtime Contract Tests**
- `RuntimeContract` base interface for all 9 services
- `MockRuntime` — mock implementation for each service
- Full test suites: Market (11), Replay (5), Plugin (3), + Strategy, Portfolio, ML, Search, EventStore, Notification

**Sprint 2.4.4 — Documentation Portal**
- 19 documentation files across 7 sections
- Architecture Overview, Layer Model, Runtime Kernel, Philosophy
- SDK docs: RuntimeAPI, EventBus, WidgetSDK, PluginSDK
- Service docs: Market, AllServices
- Event docs: 28 Topics, RuntimeEvent, RecorderMiddleware
- Plugin docs: Manifest, Lifecycle, Capabilities, Sandbox, Versioning
- Guides: Hello Widget (2 variants), Hello Plugin, Using EventBus
- Reference: API Index, Contracts, Capabilities, EventTopics
- Doc validator (`validate-docs.ts`) for automated coverage checks

**Sprint 2.4.5 — Example Plugins (Learning Staircase)**
- 7 progressive examples + 1 build-ready template
- `01-hello-widget` → `02-hello-plugin` → `03-market-heatmap` → `04-telegram-notifier` → `05-orderbook` → `06-risk-dashboard` → `07-ml-predictor`
- Covers: WidgetRegistry, Plugin lifecycle, Market API, EventBus, Commands, Search, Notifications, Realtime data, Multi-widget coordination, ML integration

**Sprint 2.4.6 — Runtime Playground**
- 8 interactive panels: EventEmitter, ServiceConsole, CommandConsole, PluginSandbox, CapabilityTester, RecorderControl, StateExplorer, ScriptRunner
- PlaygroundConsole with command history + autocomplete
- 5 built-in snippets (market, replay, plugin, events, ml)
- 4-panel responsive layout
- Full CSS styling (15KB)

**Sprint 2.4.7 — Benchmark Suite**
- Benchmark core: Runner, Registry, MetricsCollector, ReportGenerator (JSON/HTML/MD)
- 8 self-contained benchmark scenarios:
  - EventBusBench: 1K to 250K events/sec with middleware overhead
  - PluginBench: 6 lifecycle operations × 50 plugins
  - WidgetBench: 10 to 500 widgets
  - SearchBench: 100 to 100K searchable objects
  - LayoutBench: 5 operations × 100 panels
  - ReplayBench: 1× to 1000× replay speed
  - CommandBench: 1000 widgets + 5000 commands + 2000 search registrations
  - StartupBench: Cold start with 3 runs
- Benchmark Studio UI: ScenarioList, LiveCharts, ResultsTable, CompareView, BenchmarkStudio layout

### Changed
- Workspace version: 1.0.0 → 2.0.0
- Runtime Kernel now a platform foundation for 6+ clients: Workspace, Trading Lab, Mobile, Cloud Console, Marketplace, Extensions

### Removed
- Legacy service paths under `runtime/services/` — all migrated to frozen API module pattern

### Technical
- TypeScript type-check: 0 errors
- Vite production build: 287ms, 2131 modules
- Runtime source: 91 `.ts`/`.tsx` files
- All benchmark scenarios self-contained — zero hardcoded Runtime imports
