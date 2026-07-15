# Topic Convention

> **Source:** `runtime/RuntimeEvents.ts`, `runtime/EventRegistry.ts`

## Naming

All event topics follow a hierarchical namespace with dots as separators:

```
domain.action
market.tick
strategy.signal
plugin.loaded
```

## Standard Topics

### Market Events

| Topic | Payload | Description |
|-------|---------|-------------|
| `market.tick` | `{ symbol, price, volume, change }` | Real-time price update |
| `market.depth` | `{ symbol, bids, asks }` | Order book depth |
| `market.candle` | `{ symbol, interval, open, high, low, close, volume }` | Candle close |

### Strategy Events

| Topic | Payload | Description |
|-------|---------|-------------|
| `strategy.signal` | `{ id, direction, confidence }` | Trading signal |
| `strategy.started` | `{ id }` | Strategy started |
| `strategy.stopped` | `{ id, reason? }` | Strategy stopped |

### Plugin Events

| Topic | Payload | Description |
|-------|---------|-------------|
| `plugin.installed` | `{ id, version }` | Plugin registered |
| `plugin.loaded` | `{ id }` | Plugin code executed |
| `plugin.ready` | `{ id }` | Plugin fully active |
| `plugin.crashed` | `{ id, error }` | Plugin failure |
| `plugin.blocked` | `{ id, missing }` | Capability denied |

### Runtime Events

| Topic | Payload | Description |
|-------|---------|-------------|
| `runtime.started` | `{ version }` | Runtime initialized |
| `runtime.ready` | `{ services }` | All services ready |
| `runtime.shutdown` | `{ reason? }` | Runtime shutting down |

### Portfolio Events

| Topic | Payload | Description |
|-------|---------|-------------|
| `portfolio.position` | `{ symbol, side, size, pnl }` | Position update |
| `portfolio.balance` | `{ asset, free, locked, total }` | Balance update |

### System Events

| Topic | Payload | Description |
|-------|---------|-------------|
| `system.warning` | `{ message, code }` | Non-critical warning |
| `system.error` | `{ message, code, stack? }` | Critical error |

### ML Events

| Topic | Payload | Description |
|-------|---------|-------------|
| `ml.train.started` | `{ modelId }` | Training started |
| `ml.train.finished` | `{ modelId, accuracy }` | Training complete |
| `ml.predict` | `{ modelId, prediction, confidence }` | Prediction generated |

### Notification Events

| Topic | Payload | Description |
|-------|---------|-------------|
| `notification.sent` | `{ id, title, level }` | Notification dispatched |

### Replay Events

| Topic | Payload | Description |
|-------|---------|-------------|
| `replay.play` | `{ speed }` | Replay started |
| `replay.pause` | `{}` | Replay paused |
| `replay.seek` | `{ timestamp }` | Replay position changed |

## Topic Rules

1. Always use dots: `market.tick` ✅, not `market:tick` ❌
2. Always lowercase: `market.tick` ✅, not `Market.Tick` ❌
3. No special characters: `market.tick` ✅, not `market/tick!` ❌
4. Max 3 segments: `ml.train.started` ✅, not `a.b.c.d` ❌
5. Register all custom topics in EventRegistry
