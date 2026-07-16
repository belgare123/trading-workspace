/**
 * LiveOrdersPanel.tsx — Real-time open orders display
 *
 * Polls the active ExecutionGateway for open orders and renders
 * a sortable table. Updates every 2 seconds when connected.
 *
 * @since 4.9
 */

import { useState, useEffect, type ReactNode } from 'react'
import { gatewayRuntime } from '../gateway/GatewayRuntime'
import type { PanelContext } from '../../panels/PanelDefinition'
import type { Order } from '../../execution/types'

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 8,
    height: '100%',
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  th: {
    textAlign: 'left',
    padding: '6px 8px',
    borderBottom: '1px solid var(--border, #333)',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    color: 'var(--muted, #888)',
    position: 'sticky' as const,
    top: 0,
    backgroundColor: 'var(--surface, #1a1a2e)',
  } as React.CSSProperties,
  td: {
    padding: '6px 8px',
    borderBottom: '1px solid var(--border, #222)',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--muted, #666)',
    fontSize: 14,
  },
}

function statusBadgeStyle(status: string): React.CSSProperties {
  return {
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 500,
    backgroundColor:
      status === 'filled' ? '#22c55e22' :
      status === 'pending' ? '#f59e0b22' :
      status === 'cancelled' ? '#ef444422' :
      '#333',
    color:
      status === 'filled' ? '#22c55e' :
      status === 'pending' ? '#f59e0b' :
      status === 'cancelled' ? '#ef4444' :
      '#ccc',
  }
}

function sideStyle(side: string): React.CSSProperties {
  return {
    color: side === 'buy' ? '#22c55e' : '#ef4444',
    fontWeight: 600,
  }
}

const COLUMNS = ['Symbol', 'Side', 'Type', 'Qty', 'Filled', 'Price', 'Status'] as const

// ── Panel ──

export function LiveOrdersPanel(_ctx: PanelContext): ReactNode {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrders = async (): Promise<void> => {
      try {
        if (!gatewayRuntime.isConnected()) {
          setOrders([])
          return
        }
        const result = await gatewayRuntime.getGateway().getOrders({ status: 'open' })
        setOrders(result ?? [])
        setError(null)
      } catch (err) {
        setError((err as Error).message)
      }
    }

    // Fetch immediately
    fetchOrders()

    // Then poll every 2s
    const interval = setInterval(fetchOrders, 2_000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return (
      <div style={styles.empty}>
        Error: {error}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div style={styles.empty}>
        No open orders
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map(col => (
              <th key={col} style={styles.th}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id}>
              <td style={styles.td}>{order.symbol}</td>
              <td style={{ ...styles.td, ...sideStyle(order.side) }}>
                {order.side.toUpperCase()}
              </td>
              <td style={styles.td}>{order.type}</td>
              <td style={styles.td}>{order.quantity}</td>
              <td style={styles.td}>{order.filledQuantity ?? 0}</td>
              <td style={styles.td}>{order.price ?? '—'}</td>
              <td style={styles.td}>
                <span style={statusBadgeStyle(order.status)}>
                  {order.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
