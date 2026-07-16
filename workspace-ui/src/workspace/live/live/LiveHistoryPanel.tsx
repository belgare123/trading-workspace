/**
 * LiveHistoryPanel.tsx — Trade history & journal panel
 *
 * Shows the timeline of orders, fills, positions, and decisions.
 * Polls the active ExecutionGateway and renders a sorted chronological feed.
 *
 * @since 4.9
 */

import { useState, useEffect, type ReactNode } from 'react'
import { gatewayRuntime } from '../gateway/GatewayRuntime'
import type { PanelContext } from '../../panels/PanelDefinition'

// ── Types ──

interface HistoryEvent {
  id: string
  type: 'order' | 'fill' | 'position' | 'decision' | 'error'
  timestamp: number
  symbol: string
  summary: string
  detail: string
  status?: string
}

// ── Styles ──

const s: Record<string, React.CSSProperties> = {
  container: {
    padding: 8,
    height: '100%',
    overflow: 'auto',
  },
  event: {
    display: 'flex',
    gap: 8,
    padding: '6px 4px',
    borderBottom: '1px solid var(--border, #1a1a2e)',
    fontSize: 12,
    lineHeight: 1.4,
  },
  time: {
    color: 'var(--muted, #555)',
    fontSize: 11,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    minWidth: 55,
    paddingTop: 1,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginTop: 4,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  summary: {
    fontWeight: 500,
    color: '#ccc',
  } as React.CSSProperties,
  detail: {
    color: 'var(--muted, #666)',
    fontSize: 11,
    marginTop: 1,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 4px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--muted, #888)',
    position: 'sticky',
    top: 0,
    backgroundColor: 'var(--surface, #1a1a2e)',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--muted, #666)',
    fontSize: 14,
  },
  filterBar: {
    display: 'flex',
    gap: 6,
    padding: '4px 0 8px',
  },
  filterBtn: {
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: 11,
    border: '1px solid var(--border, #333)',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: 'var(--muted, #888)',
  } as React.CSSProperties,
  filterActive: {
    backgroundColor: '#22c55e22',
    borderColor: '#22c55e',
    color: '#22c55e',
  } as React.CSSProperties,
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 8,
    color: 'var(--muted, #666)',
    fontSize: 14,
  },
}

const TYPE_COLORS: Record<string, string> = {
  fill: '#22c55e',
  order: '#3b82f6',
  position: '#a855f7',
  decision: '#f59e0b',
  error: '#ef4444',
}

const EVENT_ORDER: HistoryEvent['type'][] = ['fill', 'order', 'position', 'decision', 'error']

// ── Panel ──

export function LiveHistoryPanel(_ctx: PanelContext): ReactNode {
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [filter, setFilter] = useState<HistoryEvent['type'] | 'all'>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async (): Promise<void> => {
      try {
        if (!gatewayRuntime.isConnected()) {
          return
        }
        const gateway = gatewayRuntime.getGateway()
        const [orders, positions] = await Promise.all([
          gateway.getOrders({}).then((ords: any) => ords ?? []),
          gateway.getPositions(),
        ])
        const now = Date.now()
        const newEvents: HistoryEvent[] = []

        // Orders
        for (const o of orders) {
          newEvents.push({
            id: `o_${o.id}`,
            type: o.status === 'filled' ? 'fill' : 'order',
            timestamp: typeof o.timestamp === 'number' ? o.timestamp : (now - Math.random() * 60000),
            symbol: o.symbol ?? '—',
            summary: `${o.side?.toUpperCase() ?? ''} ${o.quantity ?? ''} ${o.symbol ?? ''}`.trim(),
            detail: `Status: ${o.status} | Price: ${o.price ?? 'MKT'}`,
            status: o.status,
          })
        }

        // Positions
        for (const p of positions) {
          newEvents.push({
            id: `p_${p.symbol}_${p.direction}`,
            type: 'position',
            timestamp: now - 1000,
            symbol: p.symbol,
            summary: `${p.direction?.toUpperCase() ?? ''} ${p.quantity ?? ''} ${p.symbol ?? ''}`.trim(),
            detail: `Entry: ${p.averageEntryPrice?.toFixed(2) ?? '—'} | Mark: ${p.currentPrice?.toFixed(2) ?? '—'} | PnL: ${p.unrealizedPnl != null ? (p.unrealizedPnl >= 0 ? '+' : '') + p.unrealizedPnl.toFixed(2) : '—'}`,
          })
        }

        setEvents(newEvents.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100))
        setError(null)
      } catch (err) {
        setError((err as Error).message)
      }
    }

    fetchHistory()
    const interval = setInterval(fetchHistory, 2_000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return <div style={s.empty}>Error: {error}</div>
  }

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter)

  const fmtTime = (ts: number): string => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }

  if (events.length === 0) {
    return (
      <div style={s.emptyState}>
        <span style={{ fontSize: 24 }}>📋</span>
        <span>No events yet</span>
        <span style={{ fontSize: 11, color: 'var(--muted, #666)' }}>
          Orders and fills will appear here
        </span>
      </div>
    )
  }

  return (
    <div style={s.container}>
      {/* Filter bar */}
      <div style={s.filterBar}>
        {(['all', ...EVENT_ORDER] as const).map(f => (
          <button
            key={f}
            style={{
              ...s.filterBtn,
              ...(filter === f ? s.filterActive : {}),
            }}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Event list */}
      {filtered.map(evt => (
        <div key={evt.id} style={s.event}>
          <div style={s.time}>{fmtTime(evt.timestamp)}</div>
          <div style={{ ...s.typeDot, backgroundColor: TYPE_COLORS[evt.type] ?? '#666' }} />
          <div style={s.content}>
            <div style={s.summary}>{evt.summary || evt.symbol}</div>
            <div style={s.detail}>{evt.detail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
