/**
 * LivePositionsPanel.tsx — Real-time positions display
 *
 * Polls the active ExecutionGateway for open positions and renders
 * a table with PnL coloring. Updates every 2 seconds when connected.
 *
 * @since 4.9
 */

import { useState, useEffect, type ReactNode } from 'react'
import { gatewayRuntime } from '../gateway/GatewayRuntime'
import type { PanelContext } from '../../panels/PanelDefinition'
import type { Position } from '../../execution/types'

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

function pnlStyle(value: number): React.CSSProperties {
  return {
    fontWeight: 600,
    color: value >= 0 ? '#22c55e' : '#ef4444',
  }
}

function directionStyle(dir: string): React.CSSProperties {
  return {
    fontWeight: 600,
    color: dir === 'long' ? '#22c55e' : '#ef4444',
  }
}

const COLUMNS = ['Symbol', 'Direction', 'Size', 'Entry Price', 'Mark Price', 'PnL', 'Liq. Price'] as const

// ── Panel ──

export function LivePositionsPanel(_ctx: PanelContext): ReactNode {
  const [positions, setPositions] = useState<Position[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPositions = async (): Promise<void> => {
      try {
        if (!gatewayRuntime.isConnected()) {
          setPositions([])
          return
        }
        const result = await gatewayRuntime.getGateway().getPositions()
        setPositions(result ?? [])
        setError(null)
      } catch (err) {
        setError((err as Error).message)
      }
    }

    fetchPositions()

    const interval = setInterval(fetchPositions, 2_000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return (
      <div style={styles.empty}>
        Error: {error}
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <div style={styles.empty}>
        No open positions
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
          {positions.map(pos => {
            const pnl = pos.unrealizedPnl ?? 0
            // liquidityPrice may not be on Position type — access via bracket notation
            const posUnknown = pos as unknown as Record<string, unknown>
            const liqPrice = posUnknown.liquidationPrice as number | undefined

            return (
              <tr key={`${pos.symbol}_${pos.direction}`}>
                <td style={styles.td}>{pos.symbol}</td>
                <td style={{ ...styles.td, ...directionStyle(pos.direction) }}>
                  {pos.direction.toUpperCase()}
                </td>
                <td style={styles.td}>{pos.quantity}</td>
                <td style={styles.td}>{pos.averageEntryPrice?.toFixed(2) ?? '—'}</td>
                <td style={styles.td}>{pos.currentPrice?.toFixed(2) ?? '—'}</td>
                <td style={{ ...styles.td, ...pnlStyle(pnl) }}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                </td>
                <td style={styles.td}>
                  {liqPrice ? liqPrice.toFixed(2) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
