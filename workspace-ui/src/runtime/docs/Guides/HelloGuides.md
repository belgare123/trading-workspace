# Hello Widget

Goal: create a widget that shows the BTC price.

```typescript
// 1. Define widget
import { WidgetRegistry } from '../runtime/WidgetRegistry'
import type { WidgetDefinition } from '../runtime/types'

function BTCTicker() {
  const { events } = useRuntime()
  const [price, setPrice] = useState(0)

  useEffect(() => {
    return events.on('market.tick', (e) => {
      if (e.payload.symbol === 'BTCUSDT') setPrice(e.payload.price)
    })
  }, [])

  return <div>BTC: ${price.toFixed(2)}</div>
}

const widget: WidgetDefinition = {
  id: 'btc-ticker',
  name: 'BTC Ticker',
  description: 'Live Bitcoin price',
  category: 'monitoring',
  defaultSize: { w: 2, h: 1 },
  component: BTCTicker,
}

WidgetRegistry.register(widget)
```

# Hello Plugin

Goal: create a plugin that registers the BTC Ticker widget.

```typescript
// manifest.json
{
  "id": "btc-plugin",
  "name": "BTC Plugin",
  "version": "1.0.0",
  "permissions": ["market.read", "widget.write"],
  "dependencies": { "runtime": ">=2.0.0" }
}

// src/index.ts
import { WidgetRegistry } from '../runtime/WidgetRegistry'
import type { PluginContext } from '../runtime/PluginLoader'

export function register(ctx: PluginContext) {
  ctx.widgets.register(btcTickerWidget)
  console.log('[BTC Plugin] Registered BTC Ticker')
}

export function unregister() {
  console.log('[BTC Plugin] Cleaned up')
}
```

# Using EventBus

```typescript
// Subscribe
const unsub = runtimeEventBus.on('market.tick', handler)

// Unsubscribe
unsub()

// One-time
runtimeEventBus.once('runtime.ready', () => init())

// Wildcard
runtimeEventBus.on('market.*', handler)

// Emit
runtimeEventBus.emit('custom.event', payload, {
  source: 'MyPlugin',
  severity: 'info',
})
```
