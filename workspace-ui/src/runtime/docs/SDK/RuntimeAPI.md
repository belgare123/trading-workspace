# Runtime API

> **Source:** `runtime/api/index.ts`, `runtime/api/*.ts`

## Overview

Runtime API is the frozen public contract between Runtime Kernel and all clients. Every client (Workspace, Trading Lab, Cloud, Mobile) depends on this API.

## Quick Start

```typescript
import { useRuntime } from '../runtime'

function MyComponent() {
  const { events, services, market, replay } = useRuntime()

  // Subscribe to events
  events.on('market.tick', (evt) => {
    console.log(evt.payload)
  })

  // Call services
  const symbols = await market().symbols()
  const book = await market().orderBook('BTCUSDT')
}
```

## API Surface

### Core

| API | Description | Source |
|-----|-------------|--------|
| `RuntimeApi` | Root API exposed to all widgets | `runtime/types.ts` |
| `RuntimeApiConfig` | Configuration for API setup | `runtime/api/index.ts` |

### Service Access

```typescript
interface RuntimeApi {
  events: EventBus           // typed event bus
  services: RuntimeServicesProxy  // all services

  market(): MarketApi        // market data
  replay(): ReplayApi        // historical replay
  plugins(): PluginApi       // plugin management
  signals(): SignalApi       // signal access
  system(): SystemApi        // system health
}
```

## Contract vs Implementation

Runtime API defines **interfaces**, not implementations. A mock implementation is provided for development:

```typescript
// Development — no backend needed
// MockRuntime (runtime/contracts/MockRuntime.ts) implements all

// Production — replace with real implementation
// new RestRuntime(baseURL: string) satisfies RuntimeContract
```

## API Stability

Runtime API v2.0.0 is **frozen**. Changes are tracked in `api-snapshot.json`:

- ✅ No interface changes (add new methods, don't change existing)
- ✅ No type removal (deprecate instead)
- ✅ All new APIs go through contract tests first
- ✅ SemVer strict: major version = breaking change
