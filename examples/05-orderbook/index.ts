/**
 * Order Book Depth — real-time книга ордеров с оптимизированным рендерингом
 *
 * Добавляет к Example 4:
 * - Real-time streaming (market.depth)
 * - Throttling high-frequency обновлений
 * - Оптимизация рендеринга (React.memo, virtual list)
 * - Bid/Ask визуализация
 *
 * @since 2.0.0
 */

import { useState, useEffect, useRef, memo } from 'react'
import { WidgetRegistry } from '../../workspace-ui/src/runtime/WidgetRegistry'
import type { WidgetDefinition } from '../../workspace-ui/src/runtime/types'
import type { PluginContext } from '../../workspace-ui/src/runtime/PluginLoader'
import { runtimeEventBus } from '../../workspace-ui/src/runtime/EventBus'

/* ============================================================
 * Types
 * ============================================================ */

interface OrderLevel {
  price: number
  size: number
  total: number
}

interface DepthPayload {
  symbol: string
  bids: OrderLevel[]
  asks: OrderLevel[]
}

/* ============================================================
 * Utils: throttling (для высокочастотных обновлений)
 * ============================================================ */

function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    const now = Date.now()
    const elapsed = now - last

    if (elapsed >= ms) {
      last = now
      fn(...args)
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now()
        timer = null
        fn(...args)
      }, ms - elapsed)
    }
  }
}

/* ============================================================
 * 1. Component — OrderBookRow (memo для оптимизации)
 * ============================================================ */

const OrderBookRow = memo(function OrderBookRow({
  level,
  maxSize,
  side,
}: {
  level: OrderLevel
  maxSize: number
  side: 'bid' | 'ask'
}) {
  const barWidth = (level.size / maxSize) * 100
  const bgColor = side === 'bid' ? 'rgba(0,200,83,0.15)' : 'rgba(255,23,68,0.15)'
  const barColor = side === 'bid' ? '#00c853' : '#ff1744'

  return (
    <div style={{
      display: 'flex',
      position: 'relative',
      height: 20,
      alignItems: 'center',
      padding: '0 8px',
      fontSize: 12,
      fontFamily: 'monospace',
    }}>
      {/* Bar background */}
      <div style={{
        position: 'absolute',
        right: side === 'ask' ? 0 : undefined,
        left: side === 'bid' ? 0 : undefined,
        top: 0,
        bottom: 0,
        width: `${barWidth}%`,
        background: bgColor,
        transition: 'width 0.2s',
      }} />
      {/* Price */}
      <span style={{
        flex: 1,
        zIndex: 1,
        textAlign: side === 'ask' ? 'right' : 'left',
      }}>
        {level.price.toFixed(2)}
      </span>
      {/* Size */}
      <span style={{
        width: 80,
        textAlign: 'right',
        zIndex: 1,
      }}>
        {level.size.toFixed(4)}
      </span>
      {/* Total */}
      <span style={{
        width: 80,
        textAlign: 'right',
        zIndex: 1,
        color: '#888',
      }}>
        {level.total.toFixed(4)}
      </span>
    </div>
  )
})

/* ============================================================
 * 2. Widget — Order Book
 * ============================================================ */

function OrderBookWidget() {
  const [bids, setBids] = useState<OrderLevel[]>([])
  const [asks, setAsks] = useState<OrderLevel[]>([])
  const [spread, setSpread] = useState(0)
  const [symbol, setSymbol] = useState('BTCUSDT')

  // Throttled update: 100ms
  const updateDepth = useRef(
    throttle((payload: DepthPayload) => {
      // Сортируем bids по убыванию цены, asks по возрастанию
      const sortedBids = [...payload.bids]
        .sort((a, b) => b.price - a.price)
        .slice(0, 15)
      const sortedAsks = [...payload.asks]
        .sort((a, b) => a.price - b.price)
        .slice(0, 15)

      // Добавляем cumulative total
      let bidTotal = 0
      const bidsWithTotal = sortedBids.map((l) => {
        bidTotal += l.size
        return { ...l, total: bidTotal }
      })
      let askTotal = 0
      const asksWithTotal = sortedAsks.map((l) => {
        askTotal += l.size
        return { ...l, total: askTotal }
      })

      setBids(bidsWithTotal)
      setAsks(asksWithTotal)

      if (sortedBids.length > 0 && sortedAsks.length > 0) {
        setSpread(sortedAsks[0].price - sortedBids[0].price)
      }
    }, 100),
  ).current

  useEffect(() => {
    const unsub = runtimeEventBus.on('market.depth', (evt) => {
      updateDepth(evt.payload as DepthPayload)
    })
    return () => unsub()
  }, [])

  const maxSize = Math.max(
    ...bids.map((l) => l.size),
    ...asks.map((l) => l.size),
    0.001,
  )

  return (
    <div style={{ padding: 12 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 8,
        alignItems: 'center',
      }}>
        <h3 style={{ margin: 0 }}>📊 {symbol}</h3>
        <span style={{ fontSize: 12, color: '#888' }}>
          Spread: {spread.toFixed(2)}
        </span>
      </div>

      {/* Asks (sell side — reversed so highest bid is at bottom) */}
      <div>
        {asks.slice().reverse().map((level, i) => (
          <OrderBookRow key={`ask-${i}-${level.price}`} level={level} maxSize={maxSize} side="ask" />
        ))}
      </div>

      {/* Midpoint */}
      <div style={{
        borderTop: '1px solid #333',
        borderBottom: '1px solid #333',
        padding: '4px 8px',
        margin: '4px 0',
        textAlign: 'center',
        fontSize: 13,
      }}>
        {bids.length > 0 && asks.length > 0
          ? ((bids[0].price + asks[0].price) / 2).toFixed(2)
          : 'Loading...'}
      </div>

      {/* Bids (buy side) */}
      <div>
        {bids.map((level, i) => (
          <OrderBookRow key={`bid-${i}-${level.price}`} level={level} maxSize={maxSize} side="bid" />
        ))}
      </div>
    </div>
  )
}

/* ============================================================
 * 3. register / unregister
 * ============================================================ */

export function register(ctx: PluginContext): void {
  console.log('[OrderBook] Installing...')

  WidgetRegistry.register({
    id: 'orderbook-depth',
    name: 'Order Book Depth',
    description: 'Real-time order book with optimized rendering',
    category: 'monitoring',
    defaultSize: { w: 3, h: 6 },
    minSize: { w: 2, h: 3 },
    component: OrderBookWidget,
  })

  console.log('[OrderBook] Ready — throttling at 100ms')
}

export function unregister(): void {
  WidgetRegistry.unregister('orderbook-depth')
  console.log('[OrderBook] Unregistered')
}
