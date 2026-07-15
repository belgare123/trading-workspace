# Philosophy

## Why Another Platform?

The Runtime Kernel exists because trading tools share the same architecture:

- Consume market data
- Run strategies
- Manage risk
- Notify users
- Display dashboards

Without a platform, every tool reinvents event handling, service discovery, plugin management, and DevTools.

## Design Principles

### 1. Contract over Implementation

```
Bad:   if (runtime instanceof RestRuntime) { ... }
Good:  runtime satisfies RuntimeContract  →  any implementation
```

### 2. Convention over Configuration

```
Don't configure topics — use market.tick, strategy.signal, plugin.loaded
Don't configure event format — use RuntimeEvent<T>
Don't configure lifecycle — install → validate → load → activate → ready
```

### 3. Observability by Default

Every event is recorded. Every service emits lifecycle events. Every plugin transition is visible.

### 4. No Breaking Changes

API is frozen at v2.0.0. Only additive changes. Never remove or rename — deprecate and add new.

### 5. Version Everything

Event schema has a version field. Plugin manifests have version ranges. Service contracts use SemVer.

## What Makes a Good Runtime Implementation?

- ✅ Passes all contract tests
- ✅ Follows topic convention
- ✅ Emits RuntimeEvent<T> everywhere
- ✅ Provides DevTools integration
- ✅ Documents all custom events in EventRegistry

## What Runtime Kernel Does NOT Do

- No GUI framework — use React/Vue/Svelte in clients
- No database — use EventStore service for persistence
- No network protocol — HTTP/WS/gRPC is the transport layer, not the platform
