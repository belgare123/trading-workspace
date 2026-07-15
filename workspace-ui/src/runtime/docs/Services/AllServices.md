# Strategy Service

> **Source:** `runtime/api/strategy.ts`
> **Contract:** `StrategyRuntimeContract`

```typescript
const { strategy } = useRuntime().services

// List strategies
const list = await strategy.list()
// [{ id: 'ema-cross', name: 'EMA Cross', status: 'running', metrics: {...} }]

// Start / Stop
await strategy.start('ema-cross', { period: 20 })
await strategy.stop('ema-cross')

// Metrics
const metrics = await strategy.metrics('ema-cross')
```

# Portfolio Service

> **Source:** `runtime/api/portfolio.ts`

```typescript
const { portfolio } = useRuntime().services

// Balances
const balances = await portfolio.balance()        // all
const btc = await portfolio.balance('BTC')        // single asset

// Positions
const positions = await portfolio.positions()
```

# Replay Service

> **Source:** `runtime/api/replay.ts`

```typescript
const replay = useRuntime().replay()

await replay.play(2)       // 2x speed
await replay.pause()
await replay.seek(timestamp)
const state = await replay.state()  // 'idle' | 'playing' | 'paused'
```

# ML Service

> **Source:** `runtime/api/ml.ts`

```typescript
const { ml } = useRuntime().services

const models = await ml.list()
const result = await ml.predict('price-prediction', [42500, 42600, 42700])
// { prediction: 42800, confidence: 0.85 }
```

# EventStore Service

> **Source:** `runtime/api/eventstore.ts`

```typescript
const { eventStore } = useRuntime().services

// Query events
const events = await eventStore.query({
  topic: 'market.tick',
  from: Date.now() - 3600000,
  limit: 100,
})
```
