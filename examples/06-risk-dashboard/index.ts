/**
 * Risk Dashboard — multi-service плагин для мониторинга рисков
 *
 * Добавляет к Example 5:
 * - Несколько сервисов: Portfolio, Strategy, Market
 * - Timeline интеграция
 * - Несколько команд
 * - Несколько виджетов
 * - Search адаптер
 *
 * @since 2.0.0
 */

import { useState, useEffect } from 'react'
import { WidgetRegistry } from '../../workspace-ui/src/runtime/WidgetRegistry'
import type { WidgetDefinition } from '../../workspace-ui/src/runtime/types'
import type { PluginContext } from '../../workspace-ui/src/runtime/PluginLoader'
import { runtimeEventBus } from '../../workspace-ui/src/runtime/EventBus'

/* ============================================================
 * Services types
 * ============================================================ */

interface Position {
  symbol: string
  side: 'long' | 'short'
  size: number
  entryPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
}

interface StrategyMetrics {
  id: string
  name: string
  totalTrades: number
  winRate: number
  sharpe: number
  maxDrawdown: number
}

interface Balance {
  asset: string
  free: number
  locked: number
  total: number
}

/* ============================================================
 * Widget 1: Risk Overview
 * ============================================================ */

function RiskOverviewWidget() {
  const [portfolioValue, setPortfolioValue] = useState(0)
  const [activePositions, setActivePositions] = useState(0)
  const [dailyPnl, setDailyPnl] = useState(0)

  useEffect(() => {
    const unsubPos = runtimeEventBus.on('portfolio.position', (evt) => {
      const p = evt.payload as Position
      setActivePositions((prev) => prev + (p.size > 0 ? 1 : -1))
    })
    const unsubBal = runtimeEventBus.on('portfolio.balance', (evt) => {
      const b = evt.payload as Balance
      setPortfolioValue((prev) => prev + b.total)
    })
    return () => { unsubPos(); unsubBal() }
  }, [])

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: '0 0 12px' }}>🛡️ Risk Overview</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <MetricCard label="Portfolio" value={`$${portfolioValue.toLocaleString()}`} />
        <MetricCard label="Positions" value={String(activePositions)} />
        <MetricCard
          label="Daily P&L"
          value={`${dailyPnl >= 0 ? '+' : ''}$${dailyPnl.toFixed(2)}`}
          color={dailyPnl >= 0 ? '#00c853' : '#ff1744'}
        />
      </div>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: 12,
      background: '#1a1a2e',
      borderRadius: 8,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#fff' }}>{value}</div>
    </div>
  )
}

/* ============================================================
 * Widget 2: Active Positions
 * ============================================================ */

function RiskPositionsWidget() {
  const [positions, setPositions] = useState<Position[]>([])

  useEffect(() => {
    const unsub = runtimeEventBus.on('portfolio.position', (evt) => {
      const p = evt.payload as Position
      setPositions((prev) => {
        const idx = prev.findIndex((pos) => pos.symbol === p.symbol)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = p
          return next
        }
        return [...prev, p]
      })
    })
    return () => unsub()
  }, [])

  if (positions.length === 0) {
    return <div style={{ padding: 16, color: '#666' }}>No active positions</div>
  }

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: '0 0 8px' }}>📋 Positions</h3>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333' }}>
            <th style={{ textAlign: 'left', padding: 4 }}>Symbol</th>
            <th style={{ textAlign: 'right', padding: 4 }}>Size</th>
            <th style={{ textAlign: 'right', padding: 4 }}>Entry</th>
            <th style={{ textAlign: 'right', padding: 4 }}>P&L</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.symbol} style={{ borderBottom: '1px solid #222' }}>
              <td style={{ padding: 4 }}>
                <span style={{ color: p.side === 'long' ? '#00c853' : '#ff1744' }}>
                  {p.side === 'long' ? '▲' : '▼'}
                </span>
                {' '}{p.symbol}
              </td>
              <td style={{ textAlign: 'right', padding: 4 }}>{p.size}</td>
              <td style={{ textAlign: 'right', padding: 4 }}>${p.entryPrice.toFixed(2)}</td>
              <td style={{
                textAlign: 'right', padding: 4,
                color: p.pnl >= 0 ? '#00c853' : '#ff1744',
              }}>
                {p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ============================================================
 * Widget 3: Strategy Timeline
 * ============================================================ */

function RiskTimelineWidget() {
  const [signals, setSignals] = useState<Array<{ time: string; text: string; type: string }>>([])

  useEffect(() => {
    const unsubSignal = runtimeEventBus.on('strategy.signal', (evt) => {
      const s = evt.payload as any
      const time = new Date(evt.timestamp).toLocaleTimeString()
      setSignals((prev) =>
        [{ time, text: `${s.symbol}: ${s.direction} (${(s.confidence * 100).toFixed(0)}%)`, type: s.direction }, ...prev]
          .slice(0, 20)
      )
    })
    const unsubPos = runtimeEventBus.on('portfolio.position', (evt) => {
      const p = evt.payload as Position
      const time = new Date(evt.timestamp).toLocaleTimeString()
      setSignals((prev) =>
        [{ time, text: `${p.symbol}: ${p.side} ${p.size} @ $${p.entryPrice}`, type: 'position' }, ...prev]
          .slice(0, 20)
      )
    })
    return () => { unsubSignal(); unsubPos() }
  }, [])

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: '0 0 8px' }}>⏱️ Timeline</h3>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {signals.map((s, i) => (
          <div key={i} style={{
            padding: '4px 0',
            borderBottom: '1px solid #222',
            fontSize: 12,
            display: 'flex',
            gap: 8,
          }}>
            <span style={{ color: '#888', flexShrink: 0 }}>{s.time}</span>
            <span style={{
              color: s.type === 'buy' ? '#00c853'
                : s.type === 'sell' ? '#ff1744'
                : '#448aff',
            }}>
              {s.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
 * Commands
 * ============================================================ */

function closeAllPositions(ctx: PluginContext): void {
  console.log('[Risk] Closing all positions...')
  ctx.notifications.send({
    title: '⚠️ Close All Positions',
    message: 'This would close all open positions',
    level: 'warn',
    plugin: 'risk-dashboard',
  })
}

function riskSummary(ctx: PluginContext): void {
  console.log('[Risk] Generating summary...')
  ctx.notifications.send({
    title: '📊 Risk Summary',
    message: 'Risk summary report requested',
    level: 'info',
    plugin: 'risk-dashboard',
  })
}

/* ============================================================
 * Search
 * ============================================================ */

async function riskSearch(query: string) {
  const terms = ['risk', 'portfolio', 'position', 'exposure']
  const lower = query.toLowerCase()
  if (terms.some((t) => t.includes(lower))) {
    return [
      { title: 'Risk Dashboard', description: 'Risk monitoring plugin', type: 'plugin', url: '/risk' },
      { title: 'Portfolio Overview', description: 'Current portfolio state', type: 'page', url: '/risk/portfolio' },
      { title: 'Position Management', description: 'Active positions', type: 'page', url: '/risk/positions' },
    ]
  }
  return []
}

/* ============================================================
 * Register / Unregister
 * ============================================================ */

export function register(ctx: PluginContext): void {
  console.log('[Risk Dashboard] Installing...')

  // Widget 1: Overview
  WidgetRegistry.register({
    id: 'risk-overview',
    name: 'Risk Overview',
    description: 'Portfolio value, positions, P&L summary',
    category: 'monitoring',
    defaultSize: { w: 3, h: 2 },
    component: RiskOverviewWidget,
  })

  // Widget 2: Positions
  WidgetRegistry.register({
    id: 'risk-positions',
    name: 'Active Positions',
    description: 'Current open positions with P&L',
    category: 'monitoring',
    defaultSize: { w: 4, h: 3 },
    component: RiskPositionsWidget,
  })

  // Widget 3: Timeline
  WidgetRegistry.register({
    id: 'risk-timeline',
    name: 'Strategy Timeline',
    description: 'Real-time signal and position timeline',
    category: 'monitoring',
    defaultSize: { w: 3, h: 3 },
    component: RiskTimelineWidget,
  })

  // Commands
  ctx.commands.register({
    id: 'risk.close-all',
    name: 'Close All Positions',
    shortcut: 'Ctrl+Shift+C',
    execute: () => closeAllPositions(ctx),
  })
  ctx.commands.register({
    id: 'risk.summary',
    name: 'Risk Summary',
    shortcut: 'Ctrl+Shift+R',
    execute: () => riskSummary(ctx),
  })

  // Search
  ctx.search.register({
    id: 'risk-search',
    name: 'Risk Dashboard',
    search: riskSearch,
  })

  console.log('[Risk Dashboard] Ready — 3 widgets, 2 commands, 1 search')
}

export function unregister(): void {
  console.log('[Risk Dashboard] Cleaning up...')
  WidgetRegistry.unregister('risk-overview')
  WidgetRegistry.unregister('risk-positions')
  WidgetRegistry.unregister('risk-timeline')
  console.log('[Risk Dashboard] Unregistered')
}
