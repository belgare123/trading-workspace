/**
 * CampaignPage.tsx — Campaign Dashboard в стиле Freqtrade UI
 *
 * Вкладки: Dashboard → Trades → Charts → Logs
 * Таблицы Open/Closed сделок как в Freqtrade: с фильтром, пагинацией,
 * цветными профитами, колонками ID/Pair/Amount/Rate/Profit/Dates.
 *
 * Данные: /api/campaign/* (Vite middleware). Автообновление 1с.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

// ── Types ──

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  lastMessageAgeMs: number; reconnects: number; latencyMs: number
}

interface TradingSnapshot {
  freeBalance: number; equity: number; realisedPnl: number
  unrealisedPnl: number; totalFees: number; tradesRecorded: number
  openPositions: number; activeOrders: number; exposurePct: number
  leverage: number; winningTrades: number; losingTrades: number
  winRate: number; profitFactor: number
}

interface Snapshot {
  index: number; timestamp: number; trading: TradingSnapshot
  runtime: { rssMB: number; heapUsedMB: number; cpuPercent: number }
  health?: Record<string, ComponentHealth>
}

interface TradeRow {
  id: number; pair: string; type: 'long' | 'short'
  amount: number; openRate: number; currentRate: number
  profitPct: number; profit: number; openDate: string; closeDate?: string
  closeReason?: string; status: 'open' | 'closed'
}

// ── Helpers ──

const fmt = (n: number, d = 2) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(d)
}
const $ = (n: number) => (n < 0 ? '-$' : '$') + fmt(Math.abs(n))
const time = (ts: string | number) => {
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
const date = (ts: string | number) => new Date(ts).toLocaleString('en-GB', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})
const stageColor = (s: string) =>
  s === 'burn-in' ? '#3b82f6' : s === 'campaign' || s === 'paper-campaign' ? '#8b5cf6'
    : s === 'completed' ? '#22c55e' : s === 'failed' ? '#ef4444' : '#6b7280'
const profitColor = (p: number) => p >= 0 ? '#22c55e' : '#ef4444'

// ── API ──

let refreshKey = 0
async function fetchJson<T>(url: string): Promise<T | null> {
  try { const r = await fetch(url); return r.ok ? r.json() : null } catch { return null }
}

// ── Real trade data from Docker logs ──

interface RealTrade {
  id: number; pair: string; type: 'long' | 'short'
  amount: number; openRate: number; closeRate: number
  profitPct: number; profit: number; openDate: string
  closeDate: string; closeReason: string
}

// ── Sub-components ──

function ProfitCell({ pct, value }: { pct: number; value: number }) {
  const absVal = Math.abs(pct)
  const pctStr = (pct >= 0 ? '+' : '-') + (absVal > 0.01 ? absVal.toFixed(2) : absVal.toFixed(4))
  return (
    <span style={{ color: profitColor(pct), fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>
      {pctStr}%&nbsp;
      <span style={{ opacity: 0.7 }}>({value >= 0 ? '+' : ''}{value.toFixed(3)})</span>
    </span>
  )
}

function TradeTable({
  rows, filter, compact, onFilterChange,
}: {
  rows: TradeRow[]; filter: string; compact?: boolean
  onFilterChange: (v: string) => void
}) {
  const PAGE_SIZE = compact ? 5 : 10
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!filter) return rows
    const q = filter.toLowerCase()
    return rows.filter(r =>
      r.pair.toLowerCase().includes(q) ||
      r.type.includes(q) ||
      r.closeReason?.includes(q)
    )
  }, [rows, filter])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Reset page when filter changes
  useEffect(() => setPage(0), [filter])

  return (
    <div>
      {/* Filter */}
      <div style={{ marginBottom: 8 }}>
        <input
          value={filter}
          onChange={e => onFilterChange(e.target.value)}
          placeholder="Filter..."
          style={{
            width: 200, padding: '6px 10px', borderRadius: 6, border: '1px solid #2a2a4a',
            background: '#111125', color: '#ccc', fontSize: 12, outline: 'none',
          }}
        />
        <span style={{ marginLeft: 12, fontSize: 11, color: '#666' }}>
          {filtered.length} trades
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a4a', color: '#888', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px', width: 40 }}>ID</th>
              <th style={{ padding: '6px 8px' }}>Pair</th>
              <th style={{ padding: '6px 8px' }}>Type</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Open Rate</th>
              {!compact && <th style={{ padding: '6px 8px', textAlign: 'right' }}>Close Rate</th>}
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Profit</th>
              <th style={{ padding: '6px 8px' }}>Open Date</th>
              {!compact && <th style={{ padding: '6px 8px' }}>Close Date</th>}
              {!compact && <th style={{ padding: '6px 8px' }}>Reason</th>}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={compact ? 7 : 10} style={{ padding: 20, textAlign: 'center', color: '#666' }}>No trades</td></tr>
            ) : paged.map((t, i) => (
              <tr key={t.id} style={{
                borderBottom: '1px solid #1a1a3a',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              }}>
                <td style={{ padding: '6px 8px', color: '#666', fontFamily: 'monospace' }}>{t.id}</td>
                <td style={{ padding: '6px 8px', fontWeight: 600, color: '#e0e0e0' }}>{t.pair}</td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{
                    color: t.type === 'long' ? '#22c55e' : '#ef4444',
                    background: t.type === 'long' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                  }}>
                    {t.type === 'long' ? 'Long' : 'Short'}
                  </span>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#ccc' }}>
                  {t.amount}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#ccc' }}>
                  {t.openRate.toFixed(4)}
                </td>
                {!compact && (
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#ccc' }}>
                    {t.currentRate.toFixed(4)}
                  </td>
                )}
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                  <ProfitCell pct={t.profitPct} value={t.profit} />
                </td>
                <td style={{ padding: '6px 8px', color: '#888', fontSize: 11 }}>
                  {time(t.openDate)}
                </td>
                {!compact && (
                  <td style={{ padding: '6px 8px', color: '#888', fontSize: 11 }}>
                    {t.closeDate ? time(t.closeDate) : '—'}
                  </td>
                )}
                {!compact && (
                  <td style={{ padding: '6px 8px' }}>
                    {t.closeReason && (
                      <span style={{
                        color: t.closeReason === 'take_profit' ? '#22c55e' : t.closeReason === 'stop_loss' ? '#ef4444' : '#888',
                        fontSize: 11,
                      }}>
                        {t.closeReason.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, marginTop: 8,
          fontSize: 12, justifyContent: 'center',
        }}>
          <PageBtn disabled={page === 0} onClick={() => setPage(0)} label="‹‹" />
          <PageBtn disabled={page === 0} onClick={() => setPage(p => p - 1)} label="‹" />
          {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
            const start = Math.max(0, Math.min(page - 2, pages - 5))
            const p = start + i
            return (
              <PageBtn
                key={p}
                active={p === page}
                onClick={() => setPage(p)}
                label={String(p + 1)}
              />
            )
          })}
          <PageBtn disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} label="›" />
          <PageBtn disabled={page >= pages - 1} onClick={() => setPage(pages - 1)} label="››" />
        </div>
      )}
    </div>
  )
}

function PageBtn({ label, onClick, disabled, active }: {
  label: string; onClick: () => void; disabled?: boolean; active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 10px', borderRadius: 4, border: '1px solid #2a2a4a',
        background: active ? '#3b82f6' : 'transparent', color: disabled ? '#444' : active ? '#fff' : '#aaa',
        cursor: disabled ? 'default' : 'pointer', fontSize: 12, fontWeight: active ? 700 : 400,
        minWidth: 32,
      }}
    >
      {label}
    </button>
  )
}

// ── Main ──

export function CampaignPage() {
  const [state, setState] = useState<any>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [realTrades, setRealTrades] = useState<RealTrade[]>([])
  const [tab, setTab] = useState<'dashboard' | 'trades' | 'charts' | 'logs'>('dashboard')
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [liveTime, setLiveTime] = useState(new Date())
  const key = useRef(0)

  const refresh = useCallback(() => {
    const k = ++key.current
    Promise.all([
      fetchJson<any>('/api/campaign/state'),
      fetchJson<Snapshot[]>('/api/campaign/snapshots?limit=500'),
      fetchJson<RealTrade[]>('/api/campaign/real-trades'),
    ]).then(([s, snaps, r]) => {
      if (k !== key.current) return
      setState(s)
      if (snaps) setSnapshots(snaps)
      if (r) setRealTrades(r)
      setError(null)
    }).catch(() => { if (k === key.current) setError('Failed to load campaign data') })
  }, [])

  useEffect(() => {
    refresh(); const si = setInterval(refresh, 1000)
    const ti = setInterval(() => setLiveTime(new Date()), 1000)
    return () => { clearInterval(si); clearInterval(ti) }
  }, [refresh])

  const latest = snapshots.length ? snapshots[snapshots.length - 1] : null
  const t = latest?.trading
  const rt = latest?.runtime
  const trades: TradeRow[] = useMemo(() => {
    return realTrades.map(r => ({
      id: r.id,
      pair: r.pair,
      type: r.type,
      amount: r.amount,
      openRate: r.openRate,
      currentRate: r.closeRate,
      profitPct: r.profitPct,
      profit: r.profit,
      openDate: r.openDate,
      closeDate: r.closeDate,
      closeReason: r.closeReason,
      status: 'closed' as const,
    }))
  }, [realTrades])

  const equityData = snapshots.map(s => ({
    time: s.timestamp, equity: s.trading.equity,
    netPnl: s.trading.realisedPnl - s.trading.totalFees,
  }))

  const stage = state?.stage ?? 'unknown'
  const uptime = state?.uptime ?? '?'

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard' },
    { id: 'trades' as const, label: 'Trades' },
    { id: 'charts' as const, label: 'Chart' },
    { id: 'logs' as const, label: 'Logs' },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a1a', color: '#ccc' }}>
      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', borderBottom: '1px solid #2a2a4a',
        background: '#0f0f23', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 16 }}>📋</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#e0e0e0' }}>Paper Campaign</span>
        <span style={{
          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
          background: stageColor(stage) + '22', color: stageColor(stage),
          border: `1px solid ${stageColor(stage)}44`,
        }}>{stage.toUpperCase()}</span>
        <span style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }}>{uptime}</span>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 11, color: '#555' }}>{liveTime.toLocaleTimeString()}</span>
      </div>

      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #2a2a4a', background: '#0f0f23',
        padding: '0 16px',
      }}>
        {tabs.map(tabItem => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            style={{
              padding: '10px 16px', fontSize: 13, fontWeight: tab === tabItem.id ? 600 : 400,
              color: tab === tabItem.id ? '#e0e0e0' : '#666',
              border: 'none', borderBottom: tab === tabItem.id ? '2px solid #3b82f6' : '2px solid transparent',
              background: 'transparent', cursor: 'pointer',
              transition: 'color 0.1s',
            }}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          margin: '8px 16px', padding: '8px 12px', background: '#2e0a0a',
          border: '1px solid #ef4444', borderRadius: 6, color: '#f87171', fontSize: 12,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        {/* ═══ DASHBOARD ═══ */}
        {tab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Metrics row */}
            <div style={{ display: 'flex', gap: 1, background: '#2a2a4a', borderRadius: 8, overflow: 'hidden' }}>
              {[
                { label: 'Equity', value: t ? $(t.equity) : '—', sub: t ? `${fmt(t.unrealisedPnl)} unreal` : '', color: '#22c55e' },
                { label: 'Gross PnL', value: t ? $(t.realisedPnl) : '—', color: t && t.realisedPnl >= 0 ? '#22c55e' : '#ef4444' },
                { label: 'Net PnL', value: t ? $(t.realisedPnl - t.totalFees) : '—', color: t && t.realisedPnl - t.totalFees >= 0 ? '#22c55e' : '#ef4444' },
                { label: 'Fees', value: t ? $(t.totalFees) : '—', color: '#f59e0b' },
                { label: 'Trades', value: t ? String(t.tradesRecorded) : '—', color: '#a78bfa' },
                { label: 'Win Rate', value: t ? `${(t.winRate * 100).toFixed(1)}%` : '—', color: '#60a5fa' },
                { label: 'Positions', value: t ? String(t.openPositions) : '—', color: '#f472b6' },
              ].map(stat => (
                <div key={stat.label} style={{
                  flex: 1, padding: '10px 14px', background: '#111125',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: stat.color }}>
                    {stat.value}
                  </div>
                  {stat.sub && <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>{stat.sub}</div>}
                </div>
              ))}
            </div>

            {/* Two columns: Health + Runtime */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Health */}
              <div style={{
                background: '#111125', border: '1px solid #2a2a4a',
                borderRadius: 8, padding: 14,
              }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  ❤️ Component Health
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(['Feed', 'Broker', 'Strategy', 'Certification', 'Storage'] as const).map(name => {
                    const h = latest?.health?.[name]
                    return (
                      <div key={name} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 10px', borderRadius: 6, fontSize: 12,
                        background: 'rgba(34,197,94,0.08)',
                        border: '1px solid rgba(34,197,94,0.15)',
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                        <span style={{ fontWeight: 600, color: '#ccc' }}>{name}</span>
                        <span style={{ color: '#22c55e', marginLeft: 'auto' }}>
                          {h?.status ?? 'healthy'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Runtime */}
              <div style={{
                background: '#111125', border: '1px solid #2a2a4a',
                borderRadius: 8, padding: 14,
              }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  🧠 Runtime
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'RSS', value: rt?.rssMB ? `${Math.round(rt.rssMB)} MB` : '—' },
                    { label: 'Heap', value: rt?.heapUsedMB ? `${Math.round(rt.heapUsedMB)} MB` : '—' },
                    { label: 'CPU', value: rt?.cpuPercent != null ? `${rt.cpuPercent.toFixed(1)}%` : '—' },
                    { label: 'Reconnects', value: String(state?.reconnectCount ?? 0) },
                    { label: 'Exceptions', value: String(state?.exceptionsCount ?? 0) },
                    { label: 'Memory', value: state?.memoryMB ? `${state.memoryMB} MB` : '—' },
                  ].map(s => (
                    <div key={s.label} style={{ fontSize: 12 }}>
                      <div style={{ color: '#888' }}>{s.label}</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#e0e0e0', fontSize: 13 }}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent trades (compact) */}
            <div style={{
              background: '#111125', border: '1px solid #2a2a4a',
              borderRadius: 8, padding: 14,
            }}>
              <div style={{
                fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                📋 Recent Trades
              </div>
              <TradeTable rows={trades.slice(-10).reverse()} filter="" compact onFilterChange={() => {}} />
            </div>
          </div>
        )}

        {/* ═══ TRADES ═══ */}
        {tab === 'trades' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: '#111125', border: '1px solid #2a2a4a',
              borderRadius: 8, padding: 14,
            }}>
              <div style={{
                fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                📦 Closed Trades
              </div>
              <TradeTable rows={trades} filter={filter} onFilterChange={setFilter} />
            </div>
          </div>
        )}

        {/* ═══ CHARTS ═══ */}
        {tab === 'charts' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{
              background: '#111125', border: '1px solid #2a2a4a',
              borderRadius: 8, padding: 14,
            }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 600 }}>
                💰 Equity Curve
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={equityData}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tickFormatter={v => time(v)} tick={{ fontSize: 10, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#666' }} tickFormatter={v => $(v)} width={65} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="equity" stroke="#22c55e" fill="url(#eqGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{
              background: '#111125', border: '1px solid #2a2a4a',
              borderRadius: 8, padding: 14,
            }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 600 }}>
                📉 Net PnL Curve
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={equityData}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tickFormatter={v => time(v)} tick={{ fontSize: 10, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#666' }} tickFormatter={v => $(v)} width={65} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="netPnl" stroke="#a78bfa" fill="url(#pnlGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══ LOGS ═══ */}
        {tab === 'logs' && (
          <div style={{
            background: '#111125', border: '1px solid #2a2a4a',
            borderRadius: 8, padding: 14,
          }}>
            <div style={{
              fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              ⚡ Events & Incidents
            </div>
            {(!state?.incidents || state.incidents.length === 0) ? (
              <div style={{ fontSize: 12, color: '#666', padding: '16px 0', textAlign: 'center' }}>
                ✅ No incidents recorded
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {state.incidents.slice(-50).reverse().map((inc: any) => (
                  <div key={inc.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '6px 10px', borderRadius: 6, fontSize: 12,
                    borderLeft: `3px solid ${inc.severity === 'critical' ? '#ef4444' : inc.severity === 'warning' ? '#eab308' : '#3b82f6'}`,
                    background: inc.severity === 'critical' ? 'rgba(239,68,68,0.08)' : 'transparent',
                  }}>
                    <span>{inc.severity === 'critical' ? '🔴' : inc.severity === 'warning' ? '🟡' : '🔵'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#ccc' }}>{inc.message}</div>
                      <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                        {inc.type} · {time(inc.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default CampaignPage
