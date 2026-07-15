# RuntimeEvent

> **Source:** `runtime/RuntimeEvent.ts`

## Canonical Format

All communication in the Runtime uses a single event type:

```typescript
interface RuntimeEvent<T = unknown> {
  id: string                    // UUID v7-like
  timestamp: number             // Unix ms
  topic: string                 // market.tick
  source: string                // Producer identifier
  correlationId?: string        // Cross-event grouping
  causationId?: string          // Parent event (trace tree)
  severity: EventSeverity       // debug | info | warn | error
  version: 1                    // Schema version
  payload: T                    // Typed payload
  metadata?: Record<string, unknown>
}
```

## Creating Events

```typescript
import { createEvent } from '../runtime/RuntimeEvent'

// Simple creation
const event = createEvent('market.tick', { symbol: 'BTCUSDT', price: 50000 })

// With options
const event = createEvent('order.created', orderPayload, {
  source: 'OrderService',
  severity: 'info',
  correlationId: traceId,
  causationId: parentEventId,
  metadata: { userId }
})
```

## Lifecycle

```
createEvent
    │
    ▼
  validate (EventRegistry)
    │
    ▼
  middleware (logging, metrics, permissions)
    │
    ▼
  EventBus → subscribers
    │
    ▼
  EventRecorder → ring buffer → storage
```

## Checking Event Type

```typescript
import { isRuntimeEvent } from '../runtime/RuntimeEvent'

if (isRuntimeEvent(data)) {
  // data is RuntimeEvent
}
```

## Key Design Decisions

- **`id` is required** — every event is a first-class entity
- **`timestamp` is ms** — microsecond precision is transport-specific
- **`correlationId` links events** — all events in a flow share this
- **`causationId` builds trees** — parent-child relationships
- **`version` is 1** — incremented only when payload schema changes
