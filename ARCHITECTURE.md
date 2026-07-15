# Trading Platform Architecture

> **v1.0.0** — Platform built around a Runtime Kernel.
>
> Workspace is the **reference graphical client**. Any future interface — Trading Lab,
> Cloud Console, Mobile, CLI or third-party integrations — communicates exclusively
> through the Runtime API without depending directly on Trading Core.

---

## Architecture Principles

```
1. Trading Core contains business logic only.
2. Runtime Kernel exposes stable platform contracts.
3. Clients never access Trading Core directly.
4. Communication happens only through Runtime Services.
5. Everything is replaceable behind the Runtime API.
6. UI is stateless whenever possible.
7. Plugins are isolated and capability-driven.
```

These seven rules define every architectural decision in the project.

---

## Layer Dependency Rules

```
Clients
    │
    ▼
Runtime Kernel
    │
    ▼
Trading Core
```

**Allowed:**
- Clients → Runtime Kernel
- Runtime Kernel → Trading Core

**Forbidden:**
- Clients → Trading Core
- Trading Core → Runtime Kernel
- Trading Core → Clients
- Runtime Kernel → Clients

Violating these rules is an architecture debt that must be refactored immediately.

---

## Runtime Stability Promise

Runtime API follows semantic versioning.

| Version | Contract |
|---------|----------|
| **Minor versions** | Additive only — new services, events, capabilities. Existing APIs never break. |
| **Major versions** | Breaking changes allowed. Each break is documented with migration guide. |
| **Deprecation** | Deprecated APIs remain supported for at least **one major release** before removal. |

This ensures that plugins, clients, and third-party integrations built against
Runtime API v1.x continue working through v1.y.z updates. SDK can be supported
for years.

---

```
                          Trading Platform

                                │
                        ┌───────▼────────┐
                        │ Runtime Kernel │
                        └───────┬────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
 Runtime Services          Event Bus               Capability Guard
        │                  (Domain Events)              │
        │                       │                        │
        ├──────────────┬────────┴────────┬──────────────┤
        │              │                 │              │
   Plugin Loader   Service Registry   DI Container   Version Resolver
        │                                                │
        │                                                │
        ├──────────────┬─────────────────────────────────┤
        │              │
   Widget Registry  Command Registry
        │              │
   Search Registry  Timeline Registry
        │              │
        └──────────────┴──────────────┐
                                      │
                               Workspace SDK
                                      │
              ┌───────────────────────┼────────────────────────┐
              │                       │                        │
        Workspace UI            Trading Lab             Cloud Console
         (Reference)             (ML Client)            (Operations)
              │                       │                        │
              └───────────────────────┼────────────────────────┘
                                      │
                             Runtime API Contract
                                      │
                REST • WebSocket • gRPC • IPC • Simulation
                                      │
                                 Trading Core
```

---

## Layer 1 — Trading Core

Domain logic. No UI. No Runtime. Pure business.

| Module | Responsibility |
|--------|---------------|
| **Event Store** | Persisted event journal (SQLite), traces, aggregates, replay |
| **Replay Engine** | Historical data replay, timeline & recording |
| **Strategy Engine** | Plugin loading, strategy lifecycle, scheduling, execution |
| **Decision Engine** | Signal → opportunity → consensus → decision |
| **Lifecycle Engine** | Order management, position tracking, OME |
| **Portfolio Engine** | P&L, risk, positions, balance |
| **Risk Engine** | Risk checks, limits, compliance |
| **Learning Engine** | Model training, inference, feature store |
| **Marketplace** | Package registry, dependency resolution, CLI |

**Key principle:** Core knows nothing about HTTP, WebSocket, React, or any client.
All state changes go through Event Store. Every mutation is recorded and replayable.

```
Layer 1 — Core              Domain logic, no UI, no Runtime
Layer 2 — Runtime           Operating system of the platform
Layer 3 — Clients           Any interface (Workspace, Lab, Mobile, CLI)
```

---

## Layer 2 — Runtime Kernel

The operating system of the platform. It provides all infrastructure that clients
and plugins depend on.

### Runtime Services

Concrete implementations of domain interfaces. Widgets and plugins never call Core
directly — they call `runtime.services.*`.

| Service | Interface | Methods |
|---------|-----------|---------|
| `market` | `MarketRuntime` | `subscribe()`, `symbols()`, `price()`, `orderBook()` |
| `replay` | `ReplayRuntime` | `play()`, `pause()`, `seek()`, `setSpeed()` |
| `plugin` | `PluginRuntime` | `list()`, `enable()`, `disable()`, `install()`, `uninstall()` |
| `portfolio` | `PortfolioRuntime` | `positions()`, `balance()`, `history()` |
| `strategy` | `StrategyRuntime` | `list()`, `enable()`, `disable()`, `metrics()` |
| `ml` | `MLRuntime` | `models()`, `predict()`, `train()` |
| `notification` | `NotificationRuntime` | `send()`, `history()`, `clear()` |
| `search` | `SearchRuntime` | `query()`, `register()` |
| `eventStore` | `EventStoreRuntime` | `query()`, `subscribe()` |

Services are transport-agnostic. The same interface works over REST, WebSocket,
gRPC, IPC, or local simulation.

### Event Bus

Typed domain event bus. Every subsystem publishes and subscribes through it.

```
runtime.events.on('signal:new', handler)
runtime.events.emit('price:update', symbol, price)
```

Standard events (`RuntimeEvents.ts`):

| Category | Events |
|----------|--------|
| Runtime | `started`, `ready`, `shutdown`, `error` |
| Plugin | `installed`, `validated`, `loaded`, `activated`, `ready`, `sleeping`, `resumed`, `deactivated`, `unloaded`, `removed`, `failed`, `blocked` |
| Widget | `created`, `destroyed`, `changed`, `pinned`, `fullscreen` |
| Layout | `changed`, `preset-applied`, `reset` |
| Service | `connected`, `disconnected`, `error` |
| Data | `market-update`, `signal`, `trade`, `notification` |

Event history: last value is cached, new subscribers immediately receive current state.

### Plugin Lifecycle

Full state machine with validated transitions.

```
                    ┌──────────┐
                    │ Install  │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ Validate │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  Load    │
                    └────┬─────┘
                         │
                    ┌────▼────────┐
              ┌─────│  Activate   │─────┐
              │     └────┬────────┘     │
              │          │              │
              │    ┌─────▼──────┐       │
              │    │   Ready    │       │
              │    └─────┬──────┘       │
              │          │              │
              │    ┌─────▼──────┐       │
              ├────│  Sleep     │───────┤
              │    └─────┬──────┘       │
              │          │              │
              │    ┌─────▼────────┐     │
              └───▶│ Deactivate   │◀────┘
                   └─────┬────────┘
                         │
                    ┌────▼─────┐
                    │ Unload   │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  Remove  │
                    └──────────┘
```

Each transition checks permissions, dependency resolution, sandbox policy.
Invalid transitions return an error and do not change state.

Available transitions:

| From | To |
|------|----|
| `installed` | `validated`, `removed`, `error` |
| `validated` | `loaded`, `deactivated`, `removed`, `error` |
| `loaded` | `activated`, `sleeping`, `deactivated`, `error` |
| `activated` | `ready`, `sleeping`, `deactivated`, `error` |
| `ready` | `sleeping`, `deactivated`, `error` |
| `sleeping` | `ready`, `deactivated`, `error` |
| `deactivated` | `loaded`, `unloaded`, `removed`, `error` |
| `unloaded` | `installed`, `removed`, `error` |
| `removed` | _(terminal)_ |
| `error` | `installed`, `deactivated` |

### DI Container

```
container.register('market', new MarketService())
container.get<MarketRuntime>('market')
```

Widgets declare `dependencies: ['market', 'portfolio']` and receive services
automatically. No widget knows how the service is implemented.

### Capability Guard

```
requires: ['market.read', 'portfolio.read', 'plugin.install']
```

16 capability types:

| Domain | Capabilities |
|--------|-------------|
| Market | `market.read`, `market.write` |
| Portfolio | `portfolio.read`, `portfolio.write` |
| Strategy | `strategy.read`, `strategy.write` |
| Replay | `replay.read`, `replay.write` |
| Plugin | `plugin.install`, `plugin.manage` |
| Event Store | `eventstore.read`, `eventstore.write` |
| ML | `ml.read`, `ml.write` |
| Notifications | `notification.send` |
| Admin | `admin` |

Enables future multi-user, RBAC, cloud, sandbox plugin isolation without rewrites.

### Version Resolver

```
resolveDependencies(plugin, available) → { ok, errors, resolved }
```

Supports `^`, `~`, `>=`, `x`, `*`, and `dependencies` / `peerDependencies` /
`optionalDependencies` / `conflicts`.

### Plugin Sandbox

Three isolation levels configurable per plugin:

| Level | Isolation | DOM Access | Use Case |
|-------|-----------|------------|----------|
| `none` | None | Full | Trusted first-party plugins |
| `worker` | Web Worker | None | Data processing plugins |
| `iframe` | iframe with sandbox | Isolated | Third-party / untrusted plugins |

Infrastructure ready for full RPC-based isolation via postMessage bridge.

### Registries

| Registry | Purpose |
|----------|---------|
| **WidgetRegistry** | Register/unregister widget definitions, query by category |
| **CommandRegistry** | Register/unregister commands, keyboard shortcuts |
| **SearchRegistry** | Register search providers, query across all providers |
| **TimelineRegistry** | Register timeline event providers, filter by type/source |

---

## Runtime Contracts

The public surface of the Runtime Kernel. Every contract is versioned, typed,
and follows the Stability Promise.

### Services

```
runtime.services.market        → MarketRuntime
runtime.services.replay        → ReplayRuntime
runtime.services.plugins       → PluginRuntime
runtime.services.portfolio     → PortfolioRuntime
runtime.services.strategy      → StrategyRuntime
runtime.services.ml            → MLRuntime
runtime.services.notification  → NotificationRuntime
runtime.services.search        → SearchRuntime
runtime.services.eventStore    → EventStoreRuntime
```

Each service returns a typed implementation. The transport is invisible to the caller.

### Events

```
runtime.events.on(event, handler)       → Subscribe (returns unsubscribe fn)
runtime.events.once(event, handler)     → Subscribe once
runtime.events.emit(event, ...args)     → Publish
runtime.events.off(event, handler)      → Unsubscribe
```

24 standard events across 6 categories. Custom events supported.

### Commands

```
runtime.commands.execute('strategy.enable', { id: 'my-strategy' })
runtime.commands.palette()              → All available commands
```

Plugins register commands via `manifest.json`.

### Widgets

```
Workspace.registerWidget(definition)    → Registered in WidgetRegistry
Workspace.createWidget(id, instanceId)  → Creates a widget instance
WidgetRegistry.get('health')            → WidgetDefinition
WidgetRegistry.categories()             → Grouped by category
```

### Search

```
runtime.search.query('btc')             → SearchResult[]
runtime.search.register(provider)       → Add search source
```

### Timeline

```
runtime.timeline.query({ from, to, types }) → TimelineEntry[]
runtime.timeline.register(provider)         → Add timeline source
```

### Notifications

```
runtime.notification.send({ title, body, severity })
runtime.notification.history()          → NotificationEntry[]
```

### Capabilities

```
capabilityRegistry.grant(role, ...caps)
capabilityRegistry.check(role, required)  → { ok, missing? }
capabilityRegistry.revoke(role, ...caps)
```

---

## Layer 3 — Clients

Clients communicate exclusively through the Runtime API. They know nothing about
Core: no REST endpoints, no database, no domain internals.

| Client | Purpose |
|--------|---------|
| **Workspace UI** (Reference) | Reference graphical implementation. Demonstrates correct SDK usage. |
| **Trading Lab** (Future) | ML-focused client: backtesting, model training, data exploration |
| **Cloud Console** (Future) | Operations: deployment management, monitoring, team admin |
| **Mobile** (Future) | Push notifications, portfolio overview, quick actions |
| **CLI** (Future) | Headless operations: scripts, automation, CI/CD |
| **Third-party / Custom** | Any client built against the Runtime API contract |

### Widget Flow

```
Widget
    │
    ▼
Runtime SDK                  ← Workspace.registerWidget(), useRuntime()
    │
    ▼
Runtime Services             ← runtime.services.market.price('BTCUSDT')
    │
    ▼
Trading Core                 ← Via REST / WebSocket / gRPC / IPC / Simulation
```

**Rule: Widget never performs `fetch()`.**

If a widget needs data, it calls a Runtime Service. The service decides the
transport. The widget stays transport-agnostic. This rule is non-negotiable.

The same widget works identically in:
- **Live mode** (Runtime Services → WebSocket → Core)
- **Replay mode** (Runtime Services → Replay Engine → Event Store)
- **Simulation mode** (Runtime Services → Local mock)
- **Cloud mode** (Runtime Services → gRPC → Remote Core)

### Key rule for client developers

```
Widget → Runtime API → Runtime Services → Core
```

Not:

```
Widget → fetch() → REST → Core
```

The same Runtime API works in browser, mobile, Electron, and CLI. The transport
layer (REST / WebSocket / gRPC / IPC) is an implementation detail of Runtime Services.

---

## Workspace SDK

The public API surface for plugin and widget development.

```ts
import { Workspace } from '@trading/workspace-sdk';

Workspace.registerWidget({
  id: 'heatmap',
  title: 'Market Heatmap',
  category: 'analysis',
  defaultSize: { cols: 4, rows: 3 },
  render: Heatmap,
});
```

A plugin package structure:

```
my-plugin/
├── manifest.json         ← id, version, permissions, dependencies
├── index.ts              ← register / unregister hooks
├── widgets/
│   ├── Heatmap.tsx
│   └── Footprint.tsx
├── commands/
│   └── heatmap.ts
└── search/
    └── index.ts
```

The `manifest.json` is the contract. PluginLoader reads it, validates capabilities,
resolves dependencies, runs the full lifecycle.

### Example manifest.json

```json
{
  "id": "orderflow",
  "name": "Order Flow Suite",
  "version": "1.0.0",
  "widgets": ["orderflow", "footprint", "dom"],
  "commands": ["orderflow.depth"],
  "search": ["orderflow"],
  "permissions": ["market.read"],
  "dependencies": {
    "market": "^1.0.0"
  },
  "entry": "./index.ts"
}
```

---

## How the layers connect

```
                    Manifest (plugin package)
                         │
                    PluginLoader
                         │
            ┌────────────┴────────────┐
            │                         │
      WidgetRegistry           Container (DI)
      CommandRegistry               │
      SearchRegistry        RuntimeServices  EventBus
      TimelineRegistry            │              │
            │                 CapabilityGuard    │
            │                         │          │
            └─────────┬───────────────┴──────────┘
                      │
                 Workspace SDK
                      │
         ┌────────────┼────────────┐
         │            │            │
   Workspace UI   Trading Lab   Cloud Console
         │            │            │
         └────────────┼────────────┘
                      │
             Runtime API Contract
                      │
       REST • WebSocket • gRPC • IPC • Simulation
                      │
                 Trading Core
```

---

## Philosophy

> **Trading Platform is built around a Runtime Kernel.**
> The Runtime Kernel exposes stable contracts for services, events, plugins,
> widgets and capabilities.
> **Workspace is the reference graphical client** built on top of these contracts.
> Any future interface — including Trading Lab, Cloud Console, Mobile, CLI or
> third-party integrations — communicates exclusively through the Runtime API
> without depending directly on Trading Core.

---

## Future Packages

The Runtime Kernel lives physically inside `workspace-ui/` during v1.x for pragmatic
reasons. In v2.0 it will graduate to standalone packages:

| Package | Purpose |
|---------|---------|
| `@trading/runtime-kernel` | Core Runtime: EventBus, Container, Capabilities, PluginLoader, VersionResolver |
| `@trading/runtime-sdk` | Public SDK: `Workspace.registerWidget()` and all type exports |
| `@trading/plugin-api` | Plugin development types and helpers |
| `@trading/workspace` | Reference graphical client (this project) |
| `@trading/trading-lab` | ML-focused client (future) |

This enables any project to depend on Runtime contracts without pulling in the
full Workspace UI dependency tree.

---

## Project Structure

```
trading-workspace/
│
├── ARCHITECTURE.md           ← This file
├── workspace-ui/             ← Layer 3 — Reference Client
│   └── src/
│       ├── runtime/          ← Layer 2 — Runtime Kernel
│       │   ├── EventBus.ts
│       │   ├── Container.ts
│       │   ├── Capabilities.ts
│       │   ├── VersionResolver.ts
│       │   ├── PluginSandbox.ts
│       │   ├── PluginLoader.ts
│       │   ├── WidgetRegistry.ts
│       │   ├── RuntimeEvents.ts
│       │   ├── Manifest.ts
│       │   ├── SDK.ts
│       │   ├── LayoutEngine.ts
│       │   ├── PanelRenderer.tsx
│       │   ├── RuntimeContext.tsx
│       │   └── services/
│       │       ├── types.ts
│       │       ├── MarketService.ts
│       │       ├── ReplayService.ts
│       │       ├── PluginService.ts
│       │       ├── PortfolioService.ts
│       │       ├── StrategyService.ts
│       │       ├── MLService.ts
│       │       ├── NotificationService.ts
│       │       ├── SearchService.ts
│       │       └── EventStoreService.ts
│       ├── theme/            ← UI Foundation
│       ├── ui/               ← UI Components
│       ├── layout/           ← Shell (AppShell, Sidebar, Topbar)
│       └── pages/            ← Pages & Dashboard
│
├── core/                     ← Layer 1 — Trading Core
│   ├── event_store/
│   ├── replay/
│   ├── strategy/
│   ├── decision/
│   ├── lifecycle/
│   ├── portfolio/
│   ├── learning/
│   └── marketplace/
│
└── docs/
    └── release-roadmap.md
```
