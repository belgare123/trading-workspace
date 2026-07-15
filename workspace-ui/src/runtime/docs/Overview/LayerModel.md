# Layer Model

## Layer Separation

Runtime Kernel has strict layer boundaries. Each layer knows only about the layers below it.

```
Layer 3: Clients (Workspace, Trading Lab, Cloud, Mobile)
         │ depends on Layer 2 contracts
Layer 2: Runtime Kernel (EventBus, Services, Plugins, DevTools)
         │ depends on Layer 1 contracts
Layer 1: Trading Core (domain logic, position management)
```

## Layer 3 — Clients

- Consume Runtime API
- Never import internal Runtime files
- Communicate via contracts

```typescript
// ✅ Correct — depends on API
import { useRuntime } from '../runtime'
import type { MarketApi } from '../runtime/api'

function MyWidget() {
  const { market } = useRuntime()
}
```

## Layer 2 — Runtime Kernel

- Provides services, event bus, plugin system
- All cross-layer communication goes through EventBus
- Services implement contract interfaces

```typescript
// Inside Runtime — implements contract
export class MarketService implements MarketRuntimeContract {
  async symbols(): Promise<string[]> { ... }
  async subscribe(symbols: string[]): Promise<void> { ... }
}
```

## Layer 1 — Trading Core

- Pure domain logic
- No UI imports
- No event bus dependency
- Used by services, not by clients directly
