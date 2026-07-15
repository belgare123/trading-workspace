# Runtime API Public Contract

> **Version:** 2.0.0
> **Status:** Frozen
> **Last Updated:** 2026-07-15

## Overview

The Runtime API is the official public contract between Runtime Kernel and all clients
(Workspace, Trading Lab, Cloud Console, Mobile Client, external plugins).

**Rules:**
- No method signature changes after freeze
- Extensions only via new interfaces (e.g. `MarketExt`, `MarketV2`)
- Semantic Versioning is mandatory
- Deprecation requires 1 minor version notice

---

## Service Map

```typescript
interface RuntimeApiServices {
  market:       MarketApi
  replay:       ReplayApi
  strategy:     StrategyApi
  portfolio:    PortfolioApi
  plugin:       PluginApi
  eventStore:   EventStoreApi
  search:       SearchApi
  notification: NotificationApi
  ml:           MLApi
}

type ServiceName = keyof RuntimeApiServices
type ServiceInstance = RuntimeApiServices[ServiceName]
```

---

## MarketApi — `runtime/api/market.ts`

**Status:** ✅ Frozen v1.0.0

```typescript
interface MarketApi {
  readonly id: 'market'

  price(symbol: string): Promise<number>
  symbols(): Promise<string[]>
  subscribe(symbol: string, cb: (price: number) => void): () => void
  orderBook(symbol: string): Promise<OrderBook>
  onTick(symbol: string, cb: (tick: MarketTick) => void): () => void
}
```

### Events

| Topic | Payload | Description |
|-------|---------|-------------|
| `market.price` | `{ symbol, price }` | Цена обновлена |
| `market.tick` | `MarketTick` | Новый тик |
| `market.orderbook` | `OrderBook` | Стакан обновлён |
| `market.candle` | `Candle` | Новая свеча |
| `market.connection` | `{ status }` | Статус подключения |

### Exported Types

- `OrderBook` `{ symbol, bids, asks, timestamp }`
- `OrderBookLevel` `{ price, size }`
- `MarketTick` `{ symbol, price, volume, timestamp }`
- `Candle` `{ symbol, timeframe, open, high, low, close, volume, timestamp }`

---

## ReplayApi — `runtime/api/replay.ts`

**Status:** ✅ Frozen v1.0.0

```typescript
interface ReplayApi {
  readonly id: 'replay'

  state(): ReplayState
  isActive(): boolean
  currentTime(): string
  play(): void
  pause(): void
  seek(time: string): void
  setSpeed(speed: number): void
  getSpeed(): number
  stop(): void
}
```

### Events

| Topic | Description |
|-------|-------------|
| `replay.state` | Состояние изменено |
| `replay.time` | Время обновлено |
| `replay.speed` | Скорость изменена |
| `replay.complete` | Реплей завершён |

### Types

- `ReplayState = 'idle' | 'playing' | 'paused' | 'seeking'`

---

## StrategyApi — `runtime/api/strategy.ts`

**Status:** ✅ Frozen v1.0.0

```typescript
interface StrategyApi {
  readonly id: 'strategy'

  list(): Promise<StrategyInfo[]>
  enable(id: string): Promise<void>
  disable(id: string): Promise<void>
  metrics(id: string): Promise<StrategyMetrics>
  onSignal(id: string, cb: (signal: unknown) => void): () => void
}
```

### Types

- `StrategyInfo` `{ id, name, status, pair, pnl24h }`
- `StrategyMetrics` `{ sharpe, winRate, totalTrades, avgProfit, maxDrawdown }`

---

## PortfolioApi — `runtime/api/portfolio.ts`

**Status:** ✅ Frozen v1.0.0

```typescript
interface PortfolioApi {
  readonly id: 'portfolio'

  positions(): Promise<Position[]>
  balance(): Promise<Balance>
  history(): Promise<Position[]>
  onPositionUpdate(cb: (position: Position) => void): () => void
}
```

### Types

- `Position` `{ pair, dir, size, entry, mark, pnl, pnlPercent }`
- `Balance` `{ total, free, used, currency }`

---

## PluginApi — `runtime/api/plugin.ts`

**Status:** ✅ Frozen v1.0.0

```typescript
interface PluginApi {
  readonly id: 'plugin'

  list(): Promise<PluginInfo[]>
  enable(id: string): Promise<void>
  disable(id: string): Promise<void>
  install(path: string): Promise<void>
  uninstall(id: string): Promise<void>
  manifest(id: string): Promise<PluginManifest>
}
```

### Types

- `PluginInfo` `{ id, name, version, status, health, manifest }`
- `PluginManifest` `{ id, name, version, description?, author?, homepage?, license?, requires?, permissions? }`

---

## EventStoreApi — `runtime/api/eventstore.ts`

**Status:** ✅ Frozen v1.0.0

```typescript
interface EventStoreApi {
  readonly id: 'eventStore'

  query(filter: EventFilter): Promise<EventEntry[]>
  subscribe(filter: EventFilter, cb: (event: EventEntry) => void): () => void
  append(event: Omit<EventEntry, 'id' | 'timestamp'>): Promise<string>
}
```

### Types

- `EventEntry` `{ id, type, source, timestamp, data }`
- `EventFilter` `{ types?, sources?, limit?, from?, to? }`

---

## SearchApi — `runtime/api/search.ts`

**Status:** ✅ Frozen v1.0.0

```typescript
interface SearchApi {
  readonly id: 'search'

  query(q: string): Promise<SearchResult[]>
  register(type: string, items: SearchItem[]): void
  unregister(type: string): void
}
```

### Types

- `SearchResult` `{ id, title, description?, type, action }`
- `SearchItem` `{ id, title, keywords, type, action }`

---

## NotificationApi — `runtime/api/notification.ts`

**Status:** ✅ Frozen v1.0.0

```typescript
interface NotificationApi {
  readonly id: 'notification'

  send(message: string, level?: NotificationLevel): void
  history(): NotificationEntry[]
  clear(): void
  onNotification(cb: (entry: NotificationEntry) => void): () => void
}
```

### Types

- `NotificationLevel = 'info' | 'warn' | 'error'`
- `NotificationEntry` `{ id, message, level, timestamp, source? }`

---

## MLApi — `runtime/api/ml.ts`

**Status:** ✅ Frozen v1.0.0

```typescript
interface MLApi {
  readonly id: 'ml'

  models(): Promise<MLModel[]>
  predict(modelId: string, input: unknown): Promise<unknown>
  train(modelId: string, config?: unknown): Promise<void>
  onModelStatus(cb: (model: MLModel) => void): () => void
}
```

### Types

- `MLModel` `{ id, name, type, status, accuracy? }`

---

## Compatibility Matrix

| Client | Market | Replay | Strategy | Portfolio | Plugin | EventStore | Search | Notification | ML |
|--------|--------|--------|----------|-----------|--------|------------|--------|--------------|----|
| Workspace (Reference) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Trading Lab | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ |
| External Plugin | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Cloud Console | ✔ | — | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ |
| Mobile | ✔ | — | ✔ | ✔ | — | — | — | ✔ | — |

---

## Version Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MARKET_API_VERSION` | `1.0.0` | Market API contract version |
| `REPLAY_API_VERSION` | `1.0.0` | Replay API contract version |
| `STRATEGY_API_VERSION` | `1.0.0` | Strategy API contract version |
| `PORTFOLIO_API_VERSION` | `1.0.0` | Portfolio API contract version |
| `PLUGIN_API_VERSION` | `1.0.0` | Plugin API contract version |
| `EVENTSTORE_API_VERSION` | `1.0.0` | EventStore API contract version |
| `SEARCH_API_VERSION` | `1.0.0` | Search API contract version |
| `NOTIFICATION_API_VERSION` | `1.0.0` | Notification API contract version |
| `ML_API_VERSION` | `1.0.0` | ML API contract version |
| `RUNTIME_API_VERSION` | `2.0.0` | Runtime API overall version |
