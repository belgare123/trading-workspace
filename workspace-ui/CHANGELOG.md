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

## Strategy Studio v1.0.0 (2026-07-16)

Strategy Studio — подсистема стратегий Trading Platform. Завершено архитектурное ядро: Definition → Registry → Runtime → Consumer для всех 4 engines, ExecutionContext (фасад 7 контекстов), Composition Engine (DAG-based оркестрация).

### Added

**Sprint 3.4.1 — Strategy Runtime Foundation**
- `StrategyDefinition` — контракт стратегии (id, name, create, onBar, destroy)
- `StrategyRegistry` — singleton, регистрация/получение определений
- `StrategyRuntime` — lifecycle: создание, старт, стоп, очистка
- `StrategyExecutor` — per-bar цикл: bar → signals → conditions → actions

**Sprint 3.4.2 — Strategy Execution Context**
- `ExecutionContext` — единый фасад: MarketContext, OrderContext, PositionContext, PortfolioContext, TimeContext, IndicatorContext
- `OrderContext.submit()` — декларативные ордер-запросы (buy/sell/cancel/replace)
- `StrategyContextBar` — callback для получения бара в стратегии

**Sprint 3.4.3 — Signal Engine**
- `SignalDefinition` — контракт сигнала: evaluate(ctx, params) → SignalResult
- `SignalRegistry` — singleton
- `SignalRuntime` — binding + per-bar кэш
- 8 builtins: cross-above, cross-below, rsi-signal, macd-signal, volume-spike, breakout, trendline-break, divergence

**Sprint 3.4.4 — Condition Engine**
- `ConditionDefinition` — контракт условия: evaluate(input) → ConditionEvaluationOutput
- `ConditionRegistry` — singleton
- `ConditionRuntime` — дерево условий + per-node state management
- 9 builtins: AND, OR, NOT, XOR, Sequence, Cooldown, TimeWindow, PositionState, Drawdown
- `ConditionHelpers` — утилиты композиции условий

**Sprint 3.4.5 — Action Engine**
- `ActionDefinition` — контракт действия: execute(ctx, params) → ActionResult
- `ActionRegistry` — singleton
- `ActionRuntime` — execute + executeAll + история
- 14 builtins: BuyMarket, SellMarket, BuyLimit, SellLimit, ClosePosition, ReversePosition, ScaleIn, ScaleOut, SetStopLoss, SetTakeProfit, MoveStopToBreakeven, CancelOrder, CancelAllOrders, ReplaceOrder
- `ActionHelpers` — orderSuccess, actionError, requireParam

**Sprint 3.4.6 — Strategy Composition Engine**
- `StrategyGraph` — pure data DAG (nodes, edges, metadata, layout)
- `StrategyNode` / `StrategyEdge` — фабрики + хелперы
- `GraphValidator` — 8 проверок: циклы (Kahn), dangling edges, дубли ID, root node, совместимость типов
- `GraphScheduler` — событийный планировщик: onBar, onTick, onTrade, onTimer, onNews, onCustomEvent
- `GraphExecutor` — топологическое исполнение DAG (Kahn's algorithm), per-node state для temporal conditions
- `GraphRuntime` — фасад: load(graph) → onBar(ctx) → execution
- `GraphSerializer` — toJSON/fromJSON + JSON Schema v1
- `GraphMigration` — version migration support
- 3 template strategies: TrendFollowing, MeanReversion, Breakout

### Frozen

- **Strategy Studio Constitution v1.0** — `docs/architecture/strategy-studio-constitution.md`
- **STRATEGY_STUDIO_API** — `src/workspace/strategy/STRATEGY_STUDIO_API.ts`
- Frozen paths: definition/, runtime/, executor/, context/, signals/{definition,registry,runtime}/, conditions/{definition,registry,runtime}/, actions/{definition,registry,runtime}/, composition/{runtime,graph/GraphValidator.ts,serialization}/
- Additive Growth Rule: builtins и templates — активно расширяемы

### Technical

- TypeScript type-check: 0 errors in strategy/ module (excluding pre-existing StrategyService.ts)
- Module source: 60+ `.ts` files
- Total lines: ~2,500+ lines of TypeScript across 5 engines
- Architecture pattern: Definition → Registry → Runtime → Consumer (identical to Chart Studio)
- Pipeline: Market → Indicators → Signals → Conditions → Actions → Execution/Metrics
