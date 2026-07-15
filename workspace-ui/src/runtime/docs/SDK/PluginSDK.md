# Plugin SDK

> **Source:** `runtime/PluginLoader.ts`, `runtime/Manifest.ts`, `runtime/PluginSandbox.ts`

## Overview

Plugins are self-contained packages that extend the Runtime. Each plugin has a manifest, lifecycle, and declared capabilities.

## Plugin Structure

```
my-plugin/
├── manifest.json       ← plugin metadata
├── src/
│   └── index.ts        ← register() + unregister()
└── package.json
```

## Plugin Context

The `register()` function receives a `PluginContext` with access to:

```typescript
interface PluginContext {
  widgets: typeof WidgetRegistry    // register widgets
  events: typeof runtimeEventBus   // subscribe/emit
  container: Container             // register services
  capabilities: typeof capabilityRegistry
}
```

## Manifest

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Does something useful",
  "author": "Your Name",
  "permissions": ["market.read", "widget.write"],
  "dependencies": {
    "runtime": ">=2.0.0"
  }
}
```

## Lifecycle

```
installed → validated → loaded → activated → ready
                                    ↓
                               sleeping → ready
                        ↓
                   deactivated → unloaded → removed
```

Each transition emits a `plugin.*` event.

## Capabilities

Plugins must declare all capabilities they need:

```typescript
permissions: [
  'market.read',        // subscribe to market data
  'market.write',       // place orders
  'widget.write',       // register widgets
  'command.execute',    // register commands
  'notification.write', // send notifications
  'ml.read',            // read ML models
  'ml.write',           // train ML models
  'search.index',       // contribute search results
  'event.read',         // read event history
  'event.write',        // emit custom events
]
```

## Sandbox

Plugins run in isolation levels:

| Level | Isolation | Use Case |
|-------|-----------|----------|
| `none` | No isolation | Trusted first-party plugins |
| `iframe` | DOM isolation | UI-heavy plugins |
| `worker` | Thread isolation | CPU-intensive plugins |
| `vm` | Full sandbox | Untrusted third-party plugins |
