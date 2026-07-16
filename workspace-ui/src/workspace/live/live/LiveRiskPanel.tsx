/**
 * LiveRiskPanel.tsx — Risk metrics & kill switch panel
 *
 * Shows risk limit status, daily loss, max drawdown, position
 * concentration, and provides an emergency kill switch button.
 *
 * @since 4.9
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { gatewayRuntime } from '../gateway/GatewayRuntime'
import type { PanelContext } from '../../panels/PanelDefinition'

// ── Types ──

interface RiskMetrics {
  dailyLoss: number
  dailyLossLimit: number
  maxDrawdown: number
  maxDrawdownLimit: number
  positionConcentration: number
  openOrders: number
  openPositions: number
  killSwitchActive: boolean
}

// ── Styles ──

const s: Record<string, React.CSSProperties> = {
  container: {
    padding: 12,
    height: '100%',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid var(--border, #222)',
  },
  label: {
    fontSize: 12,
    color: 'var(--muted, #888)',
  },
  value: {
    fontSize: 13,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
  warnValue: {
    color: '#f59e0b',
  } as React.CSSProperties,
  dangerValue: {
    color: '#ef4444',
  } as React.CSSProperties,
  safeValue: {
    color: '#22c55e',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--muted, #888)',
    padding: '8px 0 4px',
    letterSpacing: '0.5px',
  } as React.CSSProperties,
  killButton: {
    padding: '10px 20px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: 'auto',
  } as React.CSSProperties,
  killActive: {
    backgroundColor: '#ef4444',
    color: '#fff',
  } as React.CSSProperties,
  killInactive: {
    backgroundColor: '#333',
    color: '#666',
  } as React.CSSProperties,
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--muted, #666)',
    fontSize: 14,
  },
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function barStyle(used: number, limit: number): React.CSSProperties {
  const ratio = limit > 0 ? used / limit : 0
  const pct = Math.min(ratio * 100, 100)
  return {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#222',
    width: '100%',
    marginTop: 4,
    position: 'relative',
  }
}

function barFill(used: number, limit: number): React.CSSProperties {
  const ratio = limit > 0 ? used / limit : 0
  const pct = Math.min(ratio * 100, 100)
  return {
    height: '100%',
    borderRadius: 2,
    width: `${pct}%`,
    backgroundColor: ratio > 0.9 ? '#ef4444' : ratio > 0.7 ? '#f59e0b' : '#22c55e',
    transition: 'width 0.3s ease',
  }
}

// ── Panel ──

export function LiveRiskPanel(_ctx: PanelContext): ReactNode {
  const [metrics, setMetrics] = useState<RiskMetrics>({
    dailyLoss: 0,
    dailyLossLimit: 500,
    maxDrawdown: 0,
    maxDrawdownLimit: 0.15,
    positionConcentration: 0,
    openOrders: 0,
    openPositions: 0,
    killSwitchActive: false,
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRisk = async (): Promise<void> => {
      try {
        if (!gatewayRuntime.isConnected()) {
          return
        }
        const gateway = gatewayRuntime.getGateway()
        const [orders, positions, _balance] = await Promise.all([
          gateway.getOrders({}),
          gateway.getPositions(),
          gateway.getBalance(),
        ])
        const openOrders = (orders ?? []).filter((o: any) => o.status === 'open' || o.status === 'pending').length
        const openPositions = (positions ?? []).length
        const totalExposure = (positions ?? []).reduce((sum: number, p: any) => sum + (p.quantity ?? 0) * (p.averageEntryPrice ?? 0), 0)
        const totalEquity = (_balance?.totalEquity ?? 10000)
        const concentration = totalEquity > 0 ? totalExposure / totalEquity : 0
        const unrealizedPnl = (positions ?? []).reduce((sum: number, p: any) => sum + (p.unrealizedPnl ?? 0), 0)

        setMetrics(prev => ({
          ...prev,
          openOrders,
          openPositions,
          positionConcentration: concentration,
          dailyLoss: unrealizedPnl < 0 ? Math.abs(unrealizedPnl) : 0,
          maxDrawdown: unrealizedPnl < 0 ? Math.abs(unrealizedPnl) / totalEquity : 0,
        }))
        setError(null)
      } catch (err) {
        setError((err as Error).message)
      }
    }

    const interval = setInterval(fetchRisk, 2_000)
    return () => clearInterval(interval)
  }, [])

  const toggleKill = useCallback(() => {
    setMetrics(prev => ({ ...prev, killSwitchActive: !prev.killSwitchActive }))
  }, [])

  if (error) {
    return <div style={s.empty}>Error: {error}</div>
  }

  const { dailyLoss, dailyLossLimit, maxDrawdown, maxDrawdownLimit, positionConcentration, openOrders, openPositions, killSwitchActive } = metrics
  const ddRatio = maxDrawdown / maxDrawdownLimit
  const concRatio = positionConcentration

  return (
    <div style={s.container}>
      <div style={s.sectionTitle}>Limits</div>

      <div style={s.row}>
        <span style={s.label}>Daily Loss</span>
        <span style={{ ...s.value, color: dailyLoss > dailyLossLimit * 0.8 ? '#ef4444' : dailyLoss > dailyLossLimit * 0.5 ? '#f59e0b' : '#22c55e' }}>
          ${dailyLoss.toFixed(0)} / ${dailyLossLimit.toFixed(0)}
        </span>
      </div>
      <div style={barStyle(dailyLoss, dailyLossLimit)}>
        <div style={barFill(dailyLoss, dailyLossLimit)} />
      </div>

      <div style={s.row}>
        <span style={s.label}>Drawdown</span>
        <span style={{ ...s.value, color: ddRatio > 0.8 ? '#ef4444' : ddRatio > 0.5 ? '#f59e0b' : '#22c55e' }}>
          {pct(maxDrawdown)} / {pct(maxDrawdownLimit)}
        </span>
      </div>
      <div style={barStyle(maxDrawdown, maxDrawdownLimit)}>
        <div style={barFill(maxDrawdown, maxDrawdownLimit)} />
      </div>

      <div style={s.sectionTitle}>Exposure</div>

      <div style={s.row}>
        <span style={s.label}>Position Concentration</span>
        <span style={{ ...s.value, color: concRatio > 0.8 ? '#ef4444' : concRatio > 0.5 ? '#f59e0b' : '#22c55e' }}>
          {pct(positionConcentration)}
        </span>
      </div>

      <div style={s.sectionTitle}>Activity</div>

      <div style={s.row}>
        <span style={s.label}>Open Orders</span>
        <span style={s.value}>{openOrders}</span>
      </div>
      <div style={s.row}>
        <span style={s.label}>Open Positions</span>
        <span style={s.value}>{openPositions}</span>
      </div>

      {/* Kill Switch */}
      <button
        style={{
          ...s.killButton,
          ...(killSwitchActive ? s.killActive : s.killInactive),
        }}
        onClick={toggleKill}
      >
        {killSwitchActive ? '⚠ KILL SWITCH ACTIVE' : 'Kill Switch Off'}
      </button>
    </div>
  )
}
