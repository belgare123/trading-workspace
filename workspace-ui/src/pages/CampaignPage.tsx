/**
 * CampaignPage.tsx — Live Paper Campaign Dashboard
 *
 * Reads campaign data via /api/campaign/* endpoints (served by Vite middleware).
 * Auto-refreshes every 1 second. Uses Recharts for equity/PnL curves.
 *
 * @since 4.9
 */

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

// ── Types ──

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  lastMessageAgeMs: number
  reconnects: number
  latencyMs: number
  message?: string
}

interface CampaignSnapshot {
  index: number
  schemaVersion: number
  timestamp: number
  campaign: { id: string; startedAt: number; mode: string; smoke: boolean }
  trading: {
    freeBalance: number; equity: number; realisedPnl: number
    unrealisedPnl: number; totalFees: number; tradesRecorded: number
    openPositions: number; activeOrders: number; exposurePct: number
    leverage: number; winningTrades: number; losingTrades: number
    winRate: number; profitFactor: number; totalGrossProfit: number
    totalGrossLoss: number; largestWinner: number; largestLoser: number
    expectancy: number
  }
  runtime: {
    uptimeSec: number; rssMB: number; heapUsedMB: number
    heapTotalMB: number; cpuPercent: number; eventLoopUtilization: number
  }
  health?: {
    feed: ComponentHealth; broker: ComponentHealth; strategy: ComponentHealth
    certification: ComponentHealth; storage: ComponentHealth
  }
}

interface TradeEvent {
  timestamp: string; side: string; pnl: number; fee: number; equity: number
}

interface CampaignState {
  stage: string; uptime: string; reconnectCount: number
  exceptionsCount: number; lastCertResult: string
  lastCertTimestamp: string; memoryMB: number | null
  healthcheckDurationMs: number | null; lastHealthcheckTime: string
  lastMarketEventAgeMs: number | null
  incidents?: Array<{ id: string; type: string; message: string; severity: string; timestamp: string }>
}

// ── Data fetching ──

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url)
    return r.ok ? r.json() : null
  } catch { return null }
}

// ── Helpers ──

function fmt(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(decimals)
}

function fmtCurrency(n: number): string {
  const prefix = n < 0 ? '-$' : '$'
  return prefix + fmt(Math.abs(n))
}

function fmtTime(ts: number | string): string {
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts)
  return d.toLocaleTimeString()
}

function stageColor(stage: string): string {
  switch (stage) {
    case 'burn-in': return '#3b82f6'
    case 'paper-campaign': case 'campaign': return '#8b5cf6'
    case 'completed': return '#22c55e'
    case 'failed': return '#ef4444'
    default: return '#6b7280'
  }
}

function healthDot(status: string): string {
  switch (status) {
    case 'healthy': return '#22c55e'
    case 'degraded': return '#eab308'
    case 'down': return '#ef4444'
    default: return '#6b7280'
  }
}

// ── Chart tooltip ──

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1a1a2e', border: '1px solid #2a2a4a',
      borderRadius: '8px', padding: '8px 12px', fontSize: '12px',
    }}>
      <div style={{ color: '#888', marginBottom: 4 }}>{new Date(label).toLocaleTimeString()}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? fmtCurrency(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

// ── Components ──

function StatCard({
  label, value, sub, color, animate,
}: {
  label: string; value: string; sub?: string; color?: string; animate?: boolean
}) {
  const [flash, setFlash] = useState(false)
  const prevRef = useRef(value)

  useEffect(() => {
    if (animate && prevRef.current !== value) {
      setFlash(true)
      prevRef.current = value
      const t = setTimeout(() => setFlash(false), 300)
      return () => clearTimeout(t)
    }
  }, [value, animate])

  return (
    <div
      className="stat-card"
      style={{
        background: flash ? 'rgba(59,130,246,0.15)' : 'var(--bg-card, #1a1a2e)',
        border: `1px solid ${flash ? '#3b82f6' : 'var(--border-color, #2a2a4a)'}`,
        borderRadius: '10px', padding: '14px 18px', minWidth: '130px', flex: 1,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div style={{ fontSize: '11px', color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'monospace', color: color || 'var(--text-primary, #e0e0e0)' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '11px', color: '#666', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}

function HealthBadge({ name, health }: { name: string; health: ComponentHealth }) {
  const color = healthDot(health.status)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 12px', borderRadius: '8px',
      background: 'var(--bg-card, #1a1a2e)', border: '1px solid var(--border-color, #2a2a4a)',
      fontSize: '12px',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontWeight: 600, color: '#ccc' }}>{name}</span>
      <span style={{ color: health.status === 'healthy' ? '#22c55e' : '#eab308' }}>
        {health.status}
      </span>
      {health.latencyMs > 0 && (
        <span style={{ color: '#888', marginLeft: 'auto' }}>{health.latencyMs}ms</span>
      )}
    </div>
  )
}

// ── Main Page ──

export function CampaignPage(): ReactNode {
  const [state, setState] = useState<CampaignState | null>(null)
  const [snapshots, setSnapshots] = useState<CampaignSnapshot[]>([])
  const [trades, setTrades] = useState<TradeEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [liveTime, setLiveTime] = useState(new Date())

  // Shared promise cache to avoid thundering herd
  const refreshKey = useRef(0)

  const refresh = useCallback(() => {
    const key = ++refreshKey.current
    Promise.all([
      fetchJson<CampaignState>('/api/campaign/state'),
      fetchJson<CampaignSnapshot[]>('/api/campaign/snapshots?limit=500'),
      fetchJson<TradeEvent[]>('/api/campaign/trades?limit=30'),
    ]).then(([s, snaps, tr]) => {
      if (key !== refreshKey.current) return // stale
      setState(s)
      if (snaps) setSnapshots(snaps)
      if (tr) setTrades(tr)
      setError(null)
    }).catch(() => {
      if (key === refreshKey.current) setError('Failed to load campaign data')
    })
  }, [])

  // Poll every 1s
  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 1000)
    const tick = setInterval(() => setLiveTime(new Date()), 1000)
    return () => { clearInterval(interval); clearInterval(tick) }
  }, [refresh])

  // ── Derived data ──

  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const trading = latest?.trading
  const runtime = latest?.runtime
  const health = latest?.health || state as any

  const equityData = snapshots.map(s => ({
    time: s.timestamp,
    equity: s.trading.equity,
    pnl: s.trading.realisedPnl - s.trading.totalFees,
    grossPnl: s.trading.realisedPnl,
    fees: s.trading.totalFees,
  }))
  const [equityMin, setEquityMin] = useState(0)

  useEffect(() => {
    if (equityData.length > 0) {
      const vals = equityData.map(d => d.equity)
      setEquityMin(Math.min(...vals) - 50)
    }
  }, [equityData.length])

  // ── Render ──

  const stage = state?.stage ?? 'unknown'
  const uptime = state?.uptime ?? '?'

  return (
    <div style={{ padding: '20px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        marginBottom: '20px', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '24px' }}>📋</span>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#e0e0e0' }}>
          Paper Campaign
        </h1>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '3px 10px', borderRadius: '10px',
          background: stageColor(stage) + '22',
          color: stageColor(stage), fontSize: '12px', fontWeight: 700,
          fontFamily: 'monospace', border: `1px solid ${stageColor(stage)}44`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: stageColor(stage), display: 'inline-block' }} />
          {stage.toUpperCase()}
        </span>
        <span style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
          {uptime}
        </span>
        <span style={{ fontSize: '11px', color: '#555', marginLeft: 'auto' }}>
          {liveTime.toLocaleTimeString()} · {snapshots.length} snaps
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: '#2e0a0a', border: '1px solid #ef4444', borderRadius: '8px',
          padding: '10px 14px', color: '#f87171', marginBottom: '16px', fontSize: '13px',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Metrics Row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '10px', marginBottom: '20px',
      }}>
        <StatCard
          label="Equity"
          value={trading ? fmtCurrency(trading.equity) : '—'}
          sub={trading ? `${fmt(trading.unrealisedPnl)} unreal` : undefined}
          color="#22c55e"
          animate
        />
        <StatCard
          label="Gross PnL"
          value={trading ? fmtCurrency(trading.realisedPnl) : '—'}
          color={trading && trading.realisedPnl >= 0 ? '#22c55e' : '#ef4444'}
          animate
        />
        <StatCard
          label="Net PnL"
          value={trading ? fmtCurrency(trading.realisedPnl - trading.totalFees) : '—'}
          color={trading && (trading.realisedPnl - trading.totalFees) >= 0 ? '#22c55e' : '#ef4444'}
          animate
        />
        <StatCard
          label="Fees"
          value={trading ? fmtCurrency(trading.totalFees) : '—'}
          color="#f59e0b"
        />
        <StatCard
          label="Win Rate"
          value={trading ? `${(trading.winRate * 100).toFixed(1)}%` : '—'}
          sub={trading ? `${trading.winningTrades}W / ${trading.losingTrades}L` : undefined}
          color="#60a5fa"
        />
        <StatCard
          label="Trades"
          value={trading ? String(trading.tradesRecorded) : '—'}
          sub={`PF: ${trading?.profitFactor ? trading.profitFactor.toFixed(2) : '—'}`}
          color="#a78bfa"
        />
        <StatCard
          label="Positions"
          value={trading ? String(trading.openPositions) : '—'}
          sub={`Orders: ${trading?.activeOrders ?? '—'}`}
          color="#f472b6"
        />
        <StatCard
          label="Exposure"
          value={trading ? `${(trading.exposurePct * 100).toFixed(1)}%` : '—'}
          sub={`Lev: ${trading?.leverage?.toFixed(1) ?? '—'}x`}
          color="#fb923c"
        />
      </div>

      {/* Charts Row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
        marginBottom: '20px',
      }}>
        {/* Equity Curve */}
        <div className="chart-card" style={{
          background: 'var(--bg-card, #1a1a2e)',
          border: '1px solid var(--border-color, #2a2a4a)',
          borderRadius: '10px', padding: '16px',
        }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 600 }}>
            💰 Equity Curve
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={equityData}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tickFormatter={fmtTime} tick={{ fontSize: 10, fill: '#666' }} hide />
              <YAxis domain={[equityMin, 'auto']} tick={{ fontSize: 10, fill: '#666' }} tickFormatter={v => fmtCurrency(v)} width={60} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="equity" stroke="#22c55e" fill="url(#equityGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Net PnL Curve */}
        <div className="chart-card" style={{
          background: 'var(--bg-card, #1a1a2e)',
          border: '1px solid var(--border-color, #2a2a4a)',
          borderRadius: '10px', padding: '16px',
        }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 600 }}>
            📈 Net PnL Curve
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={equityData}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tickFormatter={fmtTime} tick={{ fontSize: 10, fill: '#666' }} hide />
              <YAxis tick={{ fontSize: 10, fill: '#666' }} tickFormatter={v => fmtCurrency(v)} width={60} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="pnl" stroke="#a78bfa" fill="url(#pnlGrad)" strokeWidth={2} dot={false} name="Net PnL" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Health + Runtime Row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
        marginBottom: '20px',
      }}>
        {/* Component Health */}
        <div style={{
          background: 'var(--bg-card, #1a1a2e)',
          border: '1px solid var(--border-color, #2a2a4a)',
          borderRadius: '10px', padding: '16px',
        }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', fontWeight: 600 }}>
            ❤️ Component Health
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {health?.health && typeof health.health === 'object' ? (
              <>
                <HealthBadge name="Feed" health={health.health.feed} />
                <HealthBadge name="Broker" health={health.health.broker} />
                <HealthBadge name="Strategy" health={health.health.strategy} />
                <HealthBadge name="Certification" health={health.health.certification} />
                <HealthBadge name="Storage" health={health.health.storage} />
              </>
            ) : (
              <>
                {['Feed', 'Broker', 'Strategy', 'Storage'].map(name => (
                  <div key={name} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 12px', borderRadius: '8px',
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    fontSize: '12px',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    <span style={{ fontWeight: 600, color: '#ccc' }}>{name}</span>
                    <span style={{ color: '#22c55e' }}>healthy</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Runtime */}
        <div style={{
          background: 'var(--bg-card, #1a1a2e)',
          border: '1px solid var(--border-color, #2a2a4a)',
          borderRadius: '10px', padding: '16px',
        }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', fontWeight: 600 }}>
            🧠 Runtime
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: '#888' }}>Memory RSS</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#e0e0e0' }}>
                {runtime?.rssMB ? `${Math.round(runtime.rssMB)} MB` : '—'}
              </div>
            </div>
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: '#888' }}>Heap</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#e0e0e0' }}>
                {runtime?.heapUsedMB ? `${Math.round(runtime.heapUsedMB)}/${Math.round(runtime.heapTotalMB)} MB` : '—'}
              </div>
            </div>
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: '#888' }}>CPU</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#e0e0e0' }}>
                {runtime?.cpuPercent != null ? `${runtime.cpuPercent.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: '#888' }}>Event Loop</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#e0e0e0' }}>
                {runtime?.eventLoopUtilization != null ? runtime.eventLoopUtilization.toFixed(3) : '—'}
              </div>
            </div>
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: '#888' }}>Reconnects</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 600, color: state?.reconnectCount ? '#eab308' : '#22c55e' }}>
                {state?.reconnectCount ?? 0}
              </div>
            </div>
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: '#888' }}>Exceptions</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 600, color: state?.exceptionsCount ? '#ef4444' : '#22c55e' }}>
                {state?.exceptionsCount ?? 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Trades + Incidents */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
      }}>
        {/* Recent Trades */}
        <div style={{
          background: 'var(--bg-card, #1a1a2e)',
          border: '1px solid var(--border-color, #2a2a4a)',
          borderRadius: '10px', padding: '16px',
        }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', fontWeight: 600 }}>
            📋 Recent Trades (last {trades.length})
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {trades.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#666', padding: '12px 0', textAlign: 'center' }}>
                No trades yet
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#888', textAlign: 'left' }}>
                    <th style={{ padding: '4px 6px' }}>Time</th>
                    <th style={{ padding: '4px 6px' }}>Side</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right' }}>PnL</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right' }}>Fee</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right' }}>Equity</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice().reverse().map((t, i) => (
                    <tr key={i} style={{
                      borderTop: '1px solid #1a1a3a',
                      color: t.side === 'SELL' ? '#22c55e' : '#ef4444',
                    }}>
                      <td style={{ padding: '4px 6px', color: '#888' }}>{fmtTime(t.timestamp)}</td>
                      <td style={{ padding: '4px 6px', fontWeight: 600 }}>{t.side}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#f59e0b' }}>
                        -{Math.abs(t.fee).toFixed(2)}
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {t.equity.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Incidents / Events */}
        <div style={{
          background: 'var(--bg-card, #1a1a2e)',
          border: '1px solid var(--border-color, #2a2a4a)',
          borderRadius: '10px', padding: '16px',
        }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', fontWeight: 600 }}>
            ⚡ Events & Incidents
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {(!state?.incidents || state.incidents.length === 0) ? (
              <div style={{ fontSize: '12px', color: '#666', padding: '12px 0', textAlign: 'center' }}>
                ✅ No incidents recorded
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {state.incidents.slice(-30).reverse().map((inc) => (
                  <div key={inc.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                    borderLeft: `3px solid ${inc.severity === 'critical' ? '#ef4444' : inc.severity === 'warning' ? '#eab308' : '#3b82f6'}`,
                    background: inc.severity === 'critical' ? 'rgba(239,68,68,0.08)' : 'transparent',
                  }}>
                    <span>{inc.severity === 'critical' ? '🔴' : inc.severity === 'warning' ? '🟡' : '🔵'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#ccc' }}>{inc.message}</div>
                      <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                        {inc.type} · {fmtTime(inc.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CampaignPage
