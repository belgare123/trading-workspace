/**
 * Market Heatmap — real-time heatmap с Market API + EventBus
 *
 * Добавляет к Example 2:
 * - MarketApi (symbols, subscribe, orderBook)
 * - EventBus (market.tick)
 * - Capability market.read
 * - Режим real-time обновлений
 *
 * @since 2.0.0
 */

import { useState, useEffect } from 'react'
import { WidgetRegistry } from '../../workspace-ui/src/runtime/WidgetRegistry'
import type { WidgetDefinition } from '../../workspace-ui/src/runtime/types'
import type { PluginContext } from '../../workspace-ui/src/runtime/PluginLoader'
import { runtimeEventBus } from '../../workspace-ui/src/runtime/EventBus'

/* ============================================================
 * Types
 * ============================================================ */

interface MarketTickPayload {
  symbol: string
  price: number
  volume: number
  change: number
}

/* ============================================================
 * 1. Widget — Market Heatmap
 * Использует EventBus для получения тиков в реальном времени.
 * ============================================================ */

function MarketHeatmapWidget() {
  const [tickers, setTickers] = useState<Map<string, MarketTickPayload>>(new Map())

  useEffect(() => {
    const unsub = runtimeEventBus.on('market.tick', (evt) => {
      const payload = evt.payload as MarketTickPayload
      setTickers((prev) => {
        const next = new Map(prev)
        next.set(payload.symbol, payload)
        return next
      })
    })
    return () => unsub()
  }, [])

  // Цвет в зависимости от изменения цены
  const colorForChange = (change: number): string => {
    if (change > 2) return '#00c853'
    if (change > 0.5) return '#69f0ae'
    if (change < -2) return '#ff1744'
    if (change < -0.5) return '#ff5252'
    return '#bdbdbd'
  }

  const items = Array.from(tickers.values())

  if (items.length === 0) {
    return <div style={{ padding: 16, color: '#666' }}>Waiting for market data...</div>
  }

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: '0 0 12px' }}>🔥 Market Heatmap</h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
      }}>
        {items.map((t) => (
          <div key={t.symbol} style={{
            padding: 8,
            borderRadius: 6,
            background: colorForChange(t.change),
            color: Math.abs(t.change) > 2 ? '#fff' : '#000',
            textAlign: 'center',
            transition: 'background 0.3s',
          }}>
            <div style={{ fontWeight: 600, fontSize: 12 }}>{t.symbol}</div>
            <div style={{ fontSize: 14 }}>${t.price.toFixed(2)}</div>
            <div style={{ fontSize: 11 }}>
              {t.change > 0 ? '+' : ''}{t.change.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
 * 2. Search Adapter — поиск по символам
 * ============================================================ */

async function symbolSearch(query: string) {
  const ctx = (window as any).__runtime
  if (!ctx?.market) return []

  const symbols = await ctx.market.symbols()
  const lower = query.toLowerCase()

  return symbols
    .filter((s: string) => s.toLowerCase().includes(lower))
    .slice(0, 5)
    .map((s: string) => ({
      title: s,
      description: `Market symbol`,
      type: 'symbol',
      url: `/market/${s}`,
    }))
}

/* ============================================================
 * 3. register / unregister
 * ============================================================ */

export function register(ctx: PluginContext): void {
  console.log('[Market Heatmap] Installing...')

  WidgetRegistry.register({
    id: 'market-heatmap',
    name: 'Market Heatmap',
    description: 'Real-time price heatmap with color-coded changes',
    category: 'monitoring',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 2, h: 2 },
    component: MarketHeatmapWidget,
  })

  ctx.search.register({
    id: 'market-heatmap-search',
    name: 'Market Symbols',
    search: symbolSearch,
  })

  console.log('[Market Heatmap] Ready — using market.read capability')
}

export function unregister(): void {
  WidgetRegistry.unregister('market-heatmap')
  console.log('[Market Heatmap] Unregistered')
}
