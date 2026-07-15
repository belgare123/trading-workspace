# Market Service

> **Source:** `runtime/api/market.ts`, `runtime/services/MarketService.ts`
> **Contract:** `MarketRuntimeContract` → `runtime/contracts/MarketContract.ts`

Provides real-time and historical market data.

```typescript
const market = useRuntime().market()

// Symbols
const symbols = await market.symbols()

// Subscribe to ticks
const unsub = runtimeEventBus.on('market.tick', (evt) => {
  console.log(`${evt.payload.symbol}: $${evt.payload.price}`)
})
await market.subscribe(['BTCUSDT', 'ETHUSDT'])

// Order book
const book = await market.orderBook('BTCUSDT')

// Candles
const candles = await market.candles('BTCUSDT', '1h', 100)
```
