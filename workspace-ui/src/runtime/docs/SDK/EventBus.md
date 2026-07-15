# EventBus

> **Source:** `runtime/EventBus.ts`, `runtime/RuntimeEvent.ts`, `runtime/EventRegistry.ts`

## Overview

EventBus is the central communication channel. Every component communicates through typed events.

## Quick Start

```typescript
import { runtimeEventBus } from '../runtime/EventBus'

// Subscribe with type safety
const unsub = runtimeEventBus.on<MarketTick>('market.tick', (event) => {
  console.log(`Price: ${event.payload.price}`)
})

// Unsubscribe when done
unsub()
```

## Emitting Events

```typescript
// Simple emit (auto-generates RuntimeEvent)
runtimeEventBus.emit('market.tick', {
  symbol: 'BTCUSDT',
  price: 50000,
  volume: 12.5,
}, { source: 'MarketService' })

// With correlationId for trace tracking
runtimeEventBus.emit('order.created', {
  id: 'ord-123',
  symbol: 'BTCUSDT',
  side: 'buy',
  quantity: 1.0,
}, {
  source: 'OrderService',
  correlationId: 'ctx-abc-123',
  causationId: 'signal-456',
})
```

## Subscribing

### Exact topic

```typescript
runtimeEventBus.on('market.tick', (evt) => { ... })
```

### Wildcard (namespace)

```typescript
runtimeEventBus.on('market.*', (evt) => {     // all market events
  console.log(evt.topic)    // market.tick, market.depth, ...
})
```

### Catch-all

```typescript
runtimeEventBus.on('*', (evt) => {             // ALL events
  EventRecorder.record(evt)
})
```

### Once

```typescript
runtimeEventBus.once('runtime.ready', (evt) => {
  initializeAfterReady()
})
```

## Middleware

```typescript
import { runtimeEventBus, loggingMiddleware, metricsMiddleware } from '../runtime/EventBus'

runtimeEventBus.use(loggingMiddleware)    // console.log all events
runtimeEventBus.use(metricsMiddleware)    // track event counts
```

## Event Registry

```typescript
import { EventRegistry } from '../runtime/EventRegistry'

// Get schema for a topic
const schema = EventRegistry.get('market.tick')
console.log(schema?.description)  // "Биржевой тик"

// Get all events by namespace
const pluginEvents = EventRegistry.getByNamespace('plugin')
```

## Configuration

```typescript
const bus = new EventBus({ historyLimit: 1000 })
```
