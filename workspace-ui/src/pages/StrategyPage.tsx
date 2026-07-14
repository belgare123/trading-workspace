import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader } from '../components/ui'
import { getStrategies, getStrategy, controlStrategy } from '../api/strategies'
import type { RecentTrade } from '../types'

const STATUS_COLORS: Record<string, string> = {
  running: 'text-green-400 bg-green-900/20',
  paused: 'text-amber-400 bg-amber-900/20',
  stopped: 'text-red-400 bg-red-900/20',
}

const STATUS_DOTS: Record<string, string> = {
  running: 'bg-green-400 animate-pulse',
  paused: 'bg-amber-400',
  stopped: 'bg-red-400',
}

export function StrategyPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { data: strategies = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: getStrategies,
    refetchInterval: autoRefresh ? 5000 : false,
  })

  const { data: strategy, isLoading } = useQuery({
    queryKey: ['strategy', selectedId],
    queryFn: () => getStrategy(selectedId),
    enabled: !!selectedId,
    refetchInterval: autoRefresh ? 5000 : false,
  })

  const controlMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => controlStrategy(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      if (selectedId) queryClient.invalidateQueries({ queryKey: ['strategy', selectedId] })
    },
  })

  useEffect(() => {
    if (strategies.length > 0 && !selectedId) {
      setSelectedId(strategies[0].id)
    }
  }, [strategies])

  const currentStrategy = strategies.find((s) => s.id === selectedId)
  const metrics = strategy?.metrics
  const openPositions = strategy?.open_positions || []
  const recentTrades = strategy?.recent_trades || []
  const equityCurve = strategy?.equity_curve || []

  return (
    <div className="flex flex-col gap-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between bg-surface-850 rounded-lg border border-surface-700/50 p-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-surface-50">Strategies</h1>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-surface-800 text-surface-50 border border-surface-600 rounded-md px-3 py-1.5 text-sm font-mono"
          >
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {currentStrategy && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono ${STATUS_COLORS[currentStrategy.status] || 'text-surface-500'}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOTS[currentStrategy.status] || 'bg-surface-600'}`} />
              {currentStrategy.status}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              autoRefresh ? 'bg-surface-600 text-surface-200' : 'bg-surface-800 text-surface-500'
            }`}
          >
            {autoRefresh ? 'Auto 5s' : 'Manual'}
          </button>
          {currentStrategy && (
            <>
              <button
                onClick={() => controlMutation.mutate({ id: selectedId, action: 'start' })}
                disabled={currentStrategy.status === 'running'}
                className="px-3 py-1.5 rounded-md bg-green-700/30 text-green-300 text-xs hover:bg-green-700/50 disabled:opacity-30 transition-colors"
              >
                ▶ Start
              </button>
              <button
                onClick={() => controlMutation.mutate({ id: selectedId, action: 'pause' })}
                disabled={currentStrategy.status !== 'running'}
                className="px-3 py-1.5 rounded-md bg-amber-700/30 text-amber-300 text-xs hover:bg-amber-700/50 disabled:opacity-30 transition-colors"
              >
                ⏸ Pause
              </button>
              <button
                onClick={() => controlMutation.mutate({ id: selectedId, action: 'stop' })}
                disabled={currentStrategy.status === 'stopped'}
                className="px-3 py-1.5 rounded-md bg-red-700/30 text-red-300 text-xs hover:bg-red-700/50 disabled:opacity-30 transition-colors"
              >
                ⏹ Stop
              </button>
            </>
          )}
        </div>
      </div>

      {strategy && (
        <div className="flex flex-col gap-3">
          {/* ── Strategy Info ── */}
          <div className="flex items-center gap-4 px-1 text-xs text-surface-500">
            <span className="flex items-center gap-1">
              Type: <span className="text-surface-300 font-mono">{strategy.type}</span>
            </span>
            <span className="flex items-center gap-1">
              Symbol: <span className="text-surface-300 font-mono">{strategy.symbol}</span>
            </span>
            <span className="flex items-center gap-1">
              Timeframe: <span className="text-surface-300 font-mono">{strategy.timeframe}</span>
            </span>
            <span className="flex items-center gap-1">
              Version: <span className="text-surface-300 font-mono">v{strategy.version}</span>
            </span>
          </div>

          {/* ── Metric Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <MetricCard title="PnL" value={metrics?.pnl} fmt="currency" color={metrics?.pnl && metrics.pnl >= 0 ? 'text-green-400' : 'text-red-400'} />
            <MetricCard title="PnL %" value={metrics?.pnl_percent} fmt="percent" color={metrics?.pnl_percent && metrics.pnl_percent >= 0 ? 'text-green-400' : 'text-red-400'} />
            <MetricCard title="Win Rate" value={metrics?.win_rate} fmt="percent" />
            <MetricCard title="Profit Factor" value={metrics?.profit_factor} fmt="decimal" />
            <MetricCard title="Sharpe" value={metrics?.sharpe} fmt="decimal" color={metrics?.sharpe && metrics.sharpe >= 1 ? 'text-green-400' : metrics?.sharpe && metrics.sharpe >= 0 ? 'text-amber-400' : 'text-red-400'} />
            <MetricCard title="Max DD" value={metrics?.max_drawdown} fmt="percent" color="text-red-400" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricCard title="Total Trades" value={metrics?.total_trades} fmt="integer" />
            <MetricCard title="Avg Trade" value={metrics?.avg_trade} fmt="currency" />
            <MetricCard title="Avg Win" value={metrics?.avg_win} fmt="currency" color="text-green-400" />
            <MetricCard title="Avg Loss" value={metrics?.avg_loss} fmt="currency" color="text-red-400" />
          </div>

          {/* ── Equity Curve ── */}
          <Card>
            <CardHeader>
              <span className="text-sm font-semibold text-surface-50">Equity Curve</span>
              <span className="text-xs text-surface-600">
                {equityCurve.length > 0 ? `${equityCurve[0].date} → ${equityCurve[equityCurve.length - 1].date}` : ''}
              </span>
            </CardHeader>
            <EquityChart data={equityCurve} />
          </Card>

          {/* ── Open Positions ── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-surface-50">Open Positions</h3>
              <span className="text-xs text-surface-600">{openPositions.length} active</span>
            </div>
            {openPositions.length === 0 ? (
              <div className="text-surface-600 text-xs py-4 text-center bg-surface-850 rounded-lg border border-surface-700/50">
                No open positions
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {openPositions.map((pos, i) => (
                  <div key={i} className="bg-surface-850 rounded-lg border border-surface-700/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-surface-50">{pos.symbol}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          pos.direction === 'LONG' ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                        }`}>
                          {pos.direction}
                        </span>
                      </div>
                      <div className={`text-sm font-semibold font-mono ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)} ({pos.pnl_percent >= 0 ? '+' : ''}{pos.pnl_percent.toFixed(2)}%)
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[11px]">
                      <div><span className="text-surface-600">Entry</span><div className="text-surface-300 font-mono">{pos.entry}</div></div>
                      <div><span className="text-surface-600">Current</span><div className="text-surface-300 font-mono">{pos.current}</div></div>
                      <div><span className="text-surface-600">Stop</span><div className="text-surface-300 font-mono">{pos.stop}</div></div>
                      <div><span className="text-surface-600">Target</span><div className="text-surface-300 font-mono">{pos.target}</div></div>
                      <div><span className="text-surface-600">Size</span><div className="text-surface-300 font-mono">{pos.size}</div></div>
                      <div><span className="text-surface-600">Duration</span><div className="text-surface-300 font-mono">{pos.duration}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Recent Trades ── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-surface-50">Trade History</h3>
              <span className="text-xs text-surface-600">Last {recentTrades.length} trades</span>
            </div>
            <div className="bg-surface-850 rounded-lg border border-surface-700/50 overflow-hidden">
              <div className="divide-y divide-surface-700/30">
                {recentTrades.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-surface-600 text-sm py-8 text-center">Loading strategy...</div>
      )}

      {!isLoading && !strategy && strategies.length === 0 && (
        <div className="text-surface-600 text-sm py-8 text-center">No strategies available</div>
      )}
    </div>
  )
}

/* ── Sub-components ── */

function MetricCard({ title, value, fmt, color }: {
  title: string
  value?: number | null
  fmt: 'currency' | 'percent' | 'decimal' | 'integer'
  color?: string
}) {
  if (value === undefined || value === null) return null
  let display: string
  switch (fmt) {
    case 'currency':
      display = value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2)
      break
    case 'percent':
      display = `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
      break
    case 'decimal':
      display = value.toFixed(2)
      break
    case 'integer':
      display = value.toLocaleString()
      break
    default:
      display = String(value)
  }
  return (
    <div className="bg-surface-850 rounded-lg border border-surface-700/50 p-3">
      <div className="text-[10px] text-surface-600 uppercase tracking-wider mb-1">{title}</div>
      <div className={`text-lg font-semibold font-mono ${color || 'text-surface-50'}`}>
        {display}
      </div>
    </div>
  )
}

function EquityChart({ data }: { data: { date: string; value: number }[] }) {
  if (data.length < 2) return <div className="text-surface-600 text-xs py-4 text-center">Not enough data</div>

  const W = 800
  const H = 200
  const P = { top: 10, right: 10, bottom: 25, left: 50 }
  const w = W - P.left - P.right
  const h = H - P.top - P.bottom

  const values = data.map((d) => d.value)
  const min = Math.min(...values) * 0.98
  const max = Math.max(...values) * 1.02
  const range = max - min || 1

  const points = data.map((d, i) => {
    const x = P.left + (i / (data.length - 1)) * w
    const y = P.top + h - ((d.value - min) / range) * h
    return `${x},${y}`
  })

  const gridLines = 5
  const gridYs = Array.from({ length: gridLines + 1 }, (_, i) => {
    const val = min + (range / gridLines) * i
    return { y: P.top + h - ((val - min) / range) * h, label: val.toLocaleString(undefined, { maximumFractionDigits: 0 }) }
  })

  const startVal = values[0]
  const endVal = values[values.length - 1]
  const pctChange = ((endVal - startVal) / startVal) * 100
  const isUp = endVal >= startVal

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid */}
      {gridYs.map((g, i) => (
        <g key={i}>
          <line x1={P.left} y1={g.y} x2={W - P.right} y2={g.y} stroke="rgba(148,163,184,0.1)" strokeWidth={1} />
          <text x={P.left - 6} y={g.y + 3} textAnchor="end" fill="rgb(100,116,139)" fontSize={10} fontFamily="monospace">
            {g.label}
          </text>
        </g>
      ))}
      {/* Area fill */}
      <defs>
        <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isUp ? 'rgb(74,222,128)' : 'rgb(248,113,113)'} stopOpacity="0.2" />
          <stop offset="100%" stopColor={isUp ? 'rgb(74,222,128)' : 'rgb(248,113,113)'} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={`${P.left},${P.top + h} ${points.join(' ')} ${P.left + w},${P.top + h}`}
        fill="url(#equityGrad)"
      />
      {/* Line */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={isUp ? 'rgb(74,222,128)' : 'rgb(248,113,113)'}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* X-axis labels */}
      <text x={P.left} y={H - 3} fill="rgb(100,116,139)" fontSize={9} fontFamily="monospace">{data[0].date.slice(5)}</text>
      <text x={P.left + w} y={H - 3} textAnchor="end" fill="rgb(100,116,139)" fontSize={9} fontFamily="monospace">{data[data.length - 1].date.slice(5)}</text>
      {/* Change badge */}
      <text x={W - P.right} y={P.top + 14} textAnchor="end" fill={isUp ? 'rgb(74,222,128)' : 'rgb(248,113,113)'} fontSize={12} fontFamily="monospace" fontWeight="bold">
        {isUp ? '+' : ''}{pctChange.toFixed(1)}%
      </text>
    </svg>
  )
}

function TradeRow({ trade }: { trade: RecentTrade }) {
  const isWin = trade.pnl >= 0
  const date = trade.closed_at ? new Date(trade.closed_at).toLocaleString() : ''

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-surface-700/20 transition-colors">
      <div className={`w-1 h-8 rounded-full ${isWin ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="w-20 font-mono text-surface-300">{trade.symbol}</span>
      <span className={`w-12 px-1 py-0.5 rounded text-[10px] font-mono text-center ${
        trade.direction === 'LONG' ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
      }`}>
        {trade.direction}
      </span>
      <span className="font-mono text-surface-400">{trade.entry}</span>
      <span className="text-surface-600">→</span>
      <span className="font-mono text-surface-400">{trade.exit}</span>
      <span className={`font-mono font-semibold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
      </span>
      <span className={`${isWin ? 'text-green-400' : 'text-red-400'}`}>
        ({trade.pnl_percent >= 0 ? '+' : ''}{trade.pnl_percent.toFixed(2)}%)
      </span>
      <span className="text-surface-600">{trade.reason.replace('_', ' ')}</span>
      <span className="ml-auto text-surface-600 truncate">{date}</span>
    </div>
  )
}
