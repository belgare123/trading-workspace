import { useState, useMemo, useEffect } from 'react'

// ── Colours ──────────────────────────────────────────────────────────
const C = {
  bg:     '#0B0E14',
  card:   '#151922',
  border: '#1E2433',
  text:   '#E2E8F0',
  muted:  '#64748B',
  accent: '#3B82F6',
  green:  '#22C55E',
  red:    '#EF4444',
  yellow: '#EAB308',
  key:    '#818CF8',
  str:    '#22C55E',
  num:    '#F59E0B',
  bool:   '#3B82F6',
  selected: '#1E293B',
  input:  '#0F131A',
}

// ── Widget Tree Definition ───────────────────────────────────────────

interface WidgetNode {
  id: string
  name: string
  icon: string
  children: WidgetNode[]
}

const WIDGET_TREE: WidgetNode = {
  id: 'root',
  name: 'Dashboard',
  icon: '📊',
  children: [
    { id: 'metric-strip', name: 'MetricStrip', icon: '📈', children: [] },
    {
      id: 'live-signals', name: 'LiveSignals', icon: '🔍', children: [
        { id: 'signal-row', name: 'SignalRow', icon: '📄', children: [] },
      ],
    },
    {
      id: 'strategy-cards', name: 'StrategyCard', icon: '🧠', children: [
        { id: 'strategy-pnl', name: 'StrategyPnL', icon: '💰', children: [] },
        { id: 'strategy-positions', name: 'OpenPositions', icon: '📋', children: [] },
        { id: 'strategy-trades', name: 'RecentTrades', icon: '🔄', children: [] },
      ],
    },
    { id: 'pnl-summary', name: 'PnLSummary', icon: '📊', children: [] },
    {
      id: 'event-flow', name: 'EventFlow', icon: '⚡', children: [
        { id: 'event-node', name: 'EventNode', icon: '●', children: [] },
      ],
    },
    { id: 'timeline', name: 'Timeline', icon: '⏱️', children: [] },
  ],
}

// Simulated widget state for each widget
function getWidgetState(id: string): Record<string, unknown> {
  const states: Record<string, Record<string, unknown>> = {
    'metric-strip': {
      pnl: 25732,
      winrate: '55.3%',
      trades: 248,
      balance: '142,850.00',
      updateInterval: 15000,
      connector: 'useSystemOverview',
    },
    'live-signals': {
      items: '5 pairs',
      pollingMs: 10000,
      sortBy: 'score',
      descending: true,
      conectionState: 'connected',
    },
    'signal-row': {
      symbol: 'BTC/USDT',
      score: 92,
      direction: 'LONG',
      changePercent: 2.34,
    },
    'strategy-cards': {
      strategies: 3,
      totalPnL: 25732,
      avgWinrate: 55.3,
    },
    'strategy-pnl': {
      pnl: 12450.75,
      pnlPercent: 8.2,
      winRate: 62.5,
      profitFactor: 1.85,
    },
    'strategy-positions': {
      open: 2,
      symbols: ['BTC/USDT', 'ETH/USDT'],
      totalExposure: '45,200 USDT',
    },
    'strategy-trades': {
      recent: 5,
      timeframe: '24h',
      bestTrade: '+$1,240',
    },
    'pnl-summary': {
      totalPnL: 25732,
      dailyPnL: 1240,
      weeklyPnL: 5840,
      monthlyPnL: 25732,
      maxDrawdown: -3.2,
    },
    'event-flow': {
      nodes: 12,
      edges: 18,
      fps: 60,
      animating: true,
    },
    'event-node': {
      eventType: 'market.tick',
      source: 'binance',
      throughput: '18.2k/s',
    },
    'timeline': {
      currentTime: '14:32:18',
      zoom: '1x',
      bookmarks: 3,
      playing: false,
    },
    'root': {
      preset: 'default',
      widgets: 7,
      columns: 3,
      gap: 12,
      theme: 'traderwaves',
    },
  }
  return states[id] ?? { status: 'unknown' }
}

// ── Tree Node Component ──────────────────────────────────────────────
function TreeNode({
  node, depth, selected, onSelect,
}: {
  node: WidgetNode
  depth: number
  selected: string | null
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const isSelected = selected === node.id

  return (
    <div>
      <button
        onClick={() => { onSelect(node.id); if (hasChildren) setExpanded(e => !e) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', paddingLeft: 8 + depth * 16,
          border: 'none', background: isSelected ? C.selected : 'transparent',
          color: isSelected ? C.text : C.muted,
          fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'left',
          borderRadius: 3, fontFamily: 'monospace',
        }}
      >
        <span style={{ width: 12, textAlign: 'center', color: C.muted }}>
          {hasChildren ? (expanded ? '▼' : '▶') : ' '}
        </span>
        <span>{node.icon}</span>
        <span style={{ color: isSelected ? C.text : C.key }}>{node.name}</span>
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Widget Inspector ─────────────────────────────────────────────────
export function WidgetInspector() {
  const [selected, setSelected] = useState<string>('root')
  const [fps, setFps] = useState(60)

  // Simulated FPS counter
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = () => {
      frame++
      const now = performance.now()
      if (now - last >= 1000) {
        setFps(frame)
        frame = 0
        last = now
      }
      raf = requestAnimationFrame(tick)
    }
    let raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Find selected node
  const findNode = (node: WidgetNode, id: string): WidgetNode | null => {
    if (node.id === id) return node
    for (const child of node.children) {
      const found = findNode(child, id)
      if (found) return found
    }
    return null
  }

  const selectedNode = useMemo(() => findNode(WIDGET_TREE, selected), [selected])

  // Get render time (simulated)
  const renderTime = useMemo(() => {
    return (Math.random() * 8 + 0.5).toFixed(2)
  }, [selected])

  const state = selected ? getWidgetState(selected) : {}

  return (
    <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 300 }}>
      {/* Left: Widget tree */}
      <div style={{
        flex: 1, maxWidth: 320,
        background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
        padding: 8, overflow: 'auto',
      }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, padding: '0 4px', fontWeight: 600 }}>
          Widget Tree
        </div>
        <TreeNode
          node={WIDGET_TREE}
          depth={0}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      {/* Right: Details panel */}
      <div style={{
        flex: 2, display: 'flex', flexDirection: 'column',
        background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{selectedNode?.icon ?? '?'}</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{selectedNode?.name ?? 'Unknown'}</span>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>
              #{selected}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: C.muted }}>
            <span>
              FPS: <span style={{ color: fps < 30 ? C.red : fps < 50 ? C.yellow : C.green, fontWeight: 600 }}>{fps}</span>
            </span>
            <span>
              Render: <span style={{ color: C.num }}>{renderTime}ms</span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`,
          padding: '0 10px', fontSize: 11,
        }}>
          {['Props', 'State', 'Events', 'Subscriptions'].map(tab => (
            <button
              key={tab}
              style={{
                padding: '6px 12px', border: 'none', background: 'none',
                color: tab === 'Props' ? C.text : C.muted,
                borderBottom: tab === 'Props' ? `2px solid ${C.accent}` : '2px solid transparent',
                cursor: 'pointer', fontWeight: tab === 'Props' ? 600 : 400,
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px', fontSize: 12 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 16px',
          }}>
            {Object.entries(state).map(([key, val]) => (
              <div key={key} style={{ display: 'contents' }}>
                <span style={{ color: C.key, fontFamily: 'monospace' }}>{key}</span>
                <span style={{
                  color: typeof val === 'string' ? C.str
                    : typeof val === 'number' ? C.num
                    : typeof val === 'boolean' ? C.bool
                    : C.text,
                  fontFamily: 'monospace',
                }}>
                  {typeof val === 'boolean' ? String(val)
                    : typeof val === 'object' ? JSON.stringify(val)
                    : String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
