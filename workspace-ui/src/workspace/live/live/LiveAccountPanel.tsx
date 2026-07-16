/**
 * LiveAccountPanel.tsx — Account / Balance display panel
 *
 * Shows current balance, equity, cash, and margin usage.
 * Polls the active ExecutionGateway every 2 seconds when connected.
 *
 * @since 4.9
 */

import { useState, useEffect, type ReactNode } from 'react'
import { gatewayRuntime } from '../gateway/GatewayRuntime'
import type { PanelContext } from '../../panels/PanelDefinition'

// ── Styles ──

const s: Record<string, React.CSSProperties> = {
  container: {
    padding: 12,
    height: '100%',
    overflow: 'auto',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid var(--border, #222)',
  },
  label: {
    fontSize: 12,
    color: 'var(--muted, #888)',
  },
  value: {
    fontSize: 14,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
  posValue: {
    color: '#22c55e',
  } as React.CSSProperties,
  negValue: {
    color: '#ef4444',
  } as React.CSSProperties,
  header: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--muted, #888)',
    padding: '12px 0 4px',
    letterSpacing: '0.5px',
  } as React.CSSProperties,
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--muted, #666)',
    fontSize: 14,
  },
  balanceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
  },
  balanceLabel: {
    fontSize: 12,
    color: 'var(--muted, #888)',
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
  } as React.CSSProperties,
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtCurrency(n: number): string {
  return `$${fmt(Math.abs(n))}`
}

function pnlStyle(n: number): React.CSSProperties {
  return { ...s.value, color: n >= 0 ? '#22c55e' : '#ef4444' }
}

// ── Panel ──

export function LiveAccountPanel(_ctx: PanelContext): ReactNode {
  const [balance, setBalance] = useState<{ totalEquity: number; balances: Record<string, { free: number; locked: number }> } | null>(null)
  const [positions, setPositions] = useState<Array<{ unrealizedPnl: number }>>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        if (!gatewayRuntime.isConnected()) {
          setBalance(null)
          setPositions([])
          return
        }
        const [bal, pos] = await Promise.all([
          gatewayRuntime.getGateway().getBalance(),
          gatewayRuntime.getGateway().getPositions(),
        ])
        setBalance(bal)
        setPositions(pos ?? [])
        setError(null)
      } catch (err) {
        setError((err as Error).message)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 2_000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return <div style={s.empty}>Error: {error}</div>
  }

  if (!balance) {
    return <div style={s.empty}>Not connected</div>
  }

  const unrealizedPnl = positions.reduce((sum, p) => sum + (p.unrealizedPnl ?? 0), 0)
  const usdt = balance.balances['USDT'] ?? { free: 0, locked: 0 }
  const totalLocked = (balance.totalEquity ?? 0) - usdt.free

  return (
    <div style={s.container}>
      {/* Total Equity */}
      <div style={s.balanceRow}>
        <span style={s.balanceLabel}>Total Equity</span>
        <span style={s.balanceValue}>{fmtCurrency(balance.totalEquity ?? 0)}</span>
      </div>

      {/* Breakdown */}
      <div style={s.header}>Balances</div>
      <div style={s.row}>
        <span style={s.label}>Free</span>
        <span style={s.value}>{fmtCurrency(usdt.free)}</span>
      </div>
      <div style={s.row}>
        <span style={s.label}>Locked</span>
        <span style={s.value}>{fmtCurrency(totalLocked)}</span>
      </div>

      <div style={s.header}>Performance</div>
      <div style={s.row}>
        <span style={s.label}>Unrealized PnL</span>
        <span style={pnlStyle(unrealizedPnl)}>
          {unrealizedPnl >= 0 ? '+' : ''}{fmtCurrency(unrealizedPnl)}
        </span>
      </div>
    </div>
  )
}
