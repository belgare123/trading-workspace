# API Reference

> **Source:** `runtime/api/index.ts`

## MarketApi

See `runtime/api/market.ts` for full definitions.

```typescript
interface MarketApi {
  symbols(): Promise<string[]>
  subscribe(symbols: string[]): Promise<void>
  unsubscribe(symbols: string[]): Promise<void>
  orderBook(symbol: string, depth?: number): Promise<OrderBook>
  candles(symbol: string, interval?: string, limit?: number): Promise<Candle[]>
  health(): Promise<{ ok: boolean; latency: number }>
}
```

## ReplayApi

```typescript
interface ReplayApi {
  play(speed?: number): Promise<void>
  pause(): Promise<void>
  seek(timestamp: number): Promise<void>
  state(): Promise<'idle' | 'playing' | 'paused'>
  progress(): Promise<{ current: number; total: number; speed: number }>
}
```

## PluginApi

```typescript
interface PluginApi {
  list(): Promise<{ id: string; state: string; version: string }[]>
  info(id: string): Promise<{ manifest: unknown; state: string }>
}
```

## Other APIs

| Service | Source | Key Methods |
|---------|--------|-------------|
| PortfolioApi | `api/portfolio.ts` | balance, positions |
| StrategyApi | `api/strategy.ts` | list, start, stop, metrics |
| MLApi | `api/ml.ts` | list, predict |
| SearchApi | `api/search.ts` | search |
| EventStoreApi | `api/eventstore.ts` | store, query |
| NotificationApi | `api/notification.ts` | send, history |

# Contracts

> **Source:** `runtime/contracts/`

All contract tests live in `runtime/contracts/`. Each service must pass its corresponding `describe*Contract` test.

| Contract | Test File | Tests |
|----------|-----------|-------|
| MarketRuntimeContract | `MarketContract.ts` | 11 |
| ReplayRuntimeContract | `ReplayContract.ts` | 5 |
| PluginRuntimeContract | `PluginContract.ts` | 3 |
| PortfolioRuntimeContract | `ServiceContracts.ts` | 3 |
| StrategyRuntimeContract | `ServiceContracts.ts` | 3 |
| MLRuntimeContract | `ServiceContracts.ts` | 2 |
| SearchRuntimeContract | `ServiceContracts.ts` | 1 |
| EventStoreRuntimeContract | `ServiceContracts.ts` | 2 |
| NotificationRuntimeContract | `ServiceContracts.ts` | 2 |

# Capabilities Reference

Full list of all standard capabilities and their descriptions.

| Capability | Type | Description |
|-----------|------|-------------|
| `market.read` | ✅ | Subscribe to market data, symbols, order books |
| `market.write` | ✅ | Place and cancel orders |
| `widget.write` | ✅ | Register dashboard widgets |
| `command.execute` | ✅ | Register keyboard commands |
| `notification.write` | ✅ | Send user notifications |
| `ml.read` | ✅ | Read ML models and predictions |
| `ml.write` | ✅ | Train and update models |
| `search.index` | ✅ | Contribute search results |
| `event.read` | ✅ | Read event history from EventStore |
| `event.write` | ✅ | Emit custom events |
| `plugin.install` | ⚠️ | Install other plugins (high trust) |

# Event Topics Reference

Complete list of all standard event topics. See [Topics](../Events/Topics.md) for payloads.

## market.*
- `market.tick`, `market.depth`, `market.candle`

## strategy.*
- `strategy.signal`, `strategy.started`, `strategy.stopped`

## portfolio.*
- `portfolio.position`, `portfolio.balance`

## plugin.*
- `plugin.installed`, `.validated`, `.loaded`, `.activated`, `.ready`, `.sleeping`, `.resumed`, `.deactivated`, `.unloaded`, `.removed`, `.failed`, `.blocked`, `.crashed`

## runtime.*
- `runtime.started`, `runtime.ready`, `runtime.shutdown`, `runtime.error`

## system.*
- `system.warning`, `system.error`

## replay.*
- `replay.play`, `replay.pause`, `replay.seek`

## ml.*
- `ml.train.started`, `ml.train.finished`, `ml.predict`

## notification.*
- `notification.sent`
