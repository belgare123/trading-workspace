# Widget SDK

> **Source:** `runtime/types.ts`, `runtime/WidgetRegistry.ts`, `runtime/registerDefaultWidgets.ts`

## Overview

Widgets are the primary UI extension mechanism. Any plugin can register widgets.

## Widget Definition

```typescript
import type { WidgetDefinition } from '../runtime/types'
import { WidgetRegistry } from '../runtime/WidgetRegistry'
import MyWidgetComponent from './MyWidget'

const myWidget: WidgetDefinition = {
  id: 'my-widget',
  name: 'My Widget',
  description: 'Shows something useful',
  category: 'monitoring',
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 1 },
  component: MyWidgetComponent,
}

// Register
WidgetRegistry.register(myWidget)
```

## Widget Component

```typescript
import { useRuntime } from '../runtime'

interface MyWidgetProps {
  instanceId: string
  symbol?: string
}

function MyWidget({ instanceId, symbol }: MyWidgetProps) {
  const { events, market } = useRuntime()

  useEffect(() => {
    const unsub = events.on('market.tick', (evt) => {
      if (evt.payload.symbol === symbol) {
        // update
      }
    })
    return unsub
  }, [symbol])

  return <div>...</div>
}
```

## Widget Categories

| Category | Description |
|----------|-------------|
| `analysis` | Charts, indicators, data analysis |
| `trading` | Order entry, position management |
| `monitoring` | Dashboards, alerts, health |
| `ml` | Model management, predictions |
| `system` | System components, DevTools |
| `custom` | Plugin-defined categories |
