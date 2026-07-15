# Architecture

> **Source:** `runtime/api/*.ts`, `runtime/EventBus.ts`, `runtime/PluginLoader.ts`, `runtime/types.ts`

## Overview

Runtime Kernel is the platform layer between Trading Core domain logic and client applications. It provides a structured, contract-based environment for building trading tools.

```
┌─────────────────────────────────────────────────────┐
│                   Clients                            │
│  Workspace │ Trading Lab │ Cloud Console │ Mobile    │
└──────────────────┬──────────────────────────────────┘
                   │ Runtime API (contract)
┌──────────────────▼──────────────────────────────────┐
│              Runtime Kernel v2                       │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐     │
│  │ EventBus │ │ Services │ │ Plugin Runtime    │     │
│  │ typed    │ │ Market   │ │ lifecycle         │     │
│  │ pipeline │ │ Strategy │ │ sandbox           │     │
│  │ recorder │ │ Portfolio│ │ dependencies      │     │
│  └──────────┘ └──────────┘ └──────────────────┘     │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐     │
│  │ Recorder │ │ Registry │ │ Inspector         │     │
│  │ ring buf │ │ events   │ │ DevTools          │     │
│  │ storage  │ │ schemas  │ │ Profiler          │     │
│  └──────────┘ └──────────┘ └──────────────────┘     │
└──────────────────┬──────────────────────────────────┘
                   │ Runtime SDK (plugin API)
┌──────────────────▼──────────────────────────────────┐
│              Trading Core                            │
│  Domain logic · Position management · Order routing  │
└─────────────────────────────────────────────────────┘
```

## Key Decisions

### 1. Contract-first Architecture

Every service defines a **contract interface** (`MarketRuntimeContract`, `ReplayRuntimeContract`, etc.) rather than a concrete class. Clients depend only on the contract:

```typescript
// Client code depends on CONTRACT, not implementation
function createMarketWidget(api: MarketRuntimeContract) { ... }

// Any implementation works:
createMarketWidget(new MockMarketRuntime())    // development
createMarketWidget(new RestMarketRuntime())    // production
createMarketWidget(new WsMarketRuntime())      // WebSocket
```

### 2. Single Event Format

All communication uses `RuntimeEvent<T>` — one canonical type for everything. No ad-hoc callbacks, no mixed formats.

### 3. Layered Isolation

Trading Core is isolated from UI. Runtime Kernel is isolated from clients. Plugins are isolated from each other (sandbox).

## Communication Flow

```
Widget ──emit──► EventBus ──on──► Widget
                │
                ├── Middleware Pipeline
                │   ├── logging
                │   ├── metrics
                │   ├── permissions
                │   └── replay
                │
                ├── Event Recorder (ring buffer)
                │
                └── Plugin Runtime (lifecycle)
```

## Runtime Boundaries

| Boundary | What crosses it | Format |
|----------|----------------|--------|
| Client ↔ Kernel | API calls, events | `RuntimeEvent<T>`, typed service calls |
| Kernel ↔ Plugin | Lifecycle hooks, events | `PluginContext`, `RuntimeEvent<T>` |
| Kernel ↔ Services | Business data, commands | Typed service contracts |
| Plugin ↔ Plugin | Nothing (sandboxed) | - |

## Source Files

| File | Role |
|------|------|
| `runtime/api/*.ts` | Frozen public API contracts |
| `runtime/EventBus.ts` | Typed event bus + middleware |
| `runtime/RuntimeEvent.ts` | Canonical event format |
| `runtime/EventRegistry.ts` | Event schema registry |
| `runtime/EventRecorder.ts` | Ring buffer + storage |
| `runtime/PluginLoader.ts` | Plugin lifecycle management |
| `runtime/types.ts` | Widget and layout types |
| `runtime/contracts/*.ts` | Runtime contract tests |
