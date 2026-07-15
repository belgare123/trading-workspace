# Command SDK

> **Source:** `runtime/commands/`

## Overview

Commands are keyboard-executable actions. Any plugin can register commands.

```typescript
registerCommand({
  id: 'market.switch-symbol',
  name: 'Switch Symbol',
  shortcut: 'Ctrl+K',
  execute: (symbol: string) => {
    // switch active symbol
  },
})

// Execute anywhere
executeCommand('market.switch-symbol', 'BTCUSDT')
```

# Search SDK

> **Source:** `runtime/search/`

```typescript
registerSearchAdapter({
  id: 'my-adapter',
  name: 'My Data',
  search: async (query: string) => {
    return [
      { title: 'Result 1', description: '...', type: 'custom', url: '/my/1' },
    ]
  },
})
```

# Timeline SDK

> **Source:** `runtime/timeline/`

```typescript
registerTimelineSource({
  id: 'my-source',
  events: ['market.tick', 'strategy.signal'],
  getItems: (range) => TimelineItem[]
})
```
