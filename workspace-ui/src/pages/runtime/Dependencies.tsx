import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Dependency graph data ────────────────────────────────────────────
interface GraphNode {
  id: string; label: string; type: 'plugin' | 'service' | 'runtime'; status: string
}
interface GraphEdge {
  from: string; to: string; label?: string
}

const NODES: GraphNode[] = [
  { id: 'heatmap',     label: 'Heatmap',        type: 'plugin',  status: 'Running' },
  { id: 'signal',      label: 'Signal Engine',  type: 'plugin',  status: 'Running' },
  { id: 'telegram',    label: 'Telegram',       type: 'plugin',  status: 'Idle' },
  { id: 'orderflow',   label: 'OrderFlow',      type: 'plugin',  status: 'Error' },
  { id: 'sentiment',   label: 'Sentiment',      type: 'plugin',  status: 'Running' },
  { id: 'news',        label: 'News Alerts',    type: 'plugin',  status: 'Paused' },
  { id: 'runtime',     label: 'Runtime Kernel', type: 'runtime', status: 'Active' },
  { id: 'eventstore',  label: 'Event Store',    type: 'service', status: 'Running' },
  { id: 'market',      label: 'Market Service', type: 'service', status: 'Running' },
  { id: 'replay',      label: 'Replay',         type: 'service', status: 'Running' },
  { id: 'portfolio',   label: 'Portfolio',      type: 'service', status: 'Running' },
  { id: 'notify',      label: 'Notification',   type: 'service', status: 'Running' },
  { id: 'widgetreg',   label: 'Widget Registry',type: 'service', status: 'Running' },
]

const EDGES: GraphEdge[] = [
  { from: 'heatmap',   to: 'runtime' },
  { from: 'heatmap',   to: 'market' },
  { from: 'heatmap',   to: 'eventstore' },
  { from: 'heatmap',   to: 'widgetreg' },
  { from: 'heatmap',   to: 'notify' },
  { from: 'signal',    to: 'runtime' },
  { from: 'signal',    to: 'market' },
  { from: 'signal',    to: 'eventstore' },
  { from: 'signal',    to: 'portfolio' },
  { from: 'telegram',  to: 'runtime' },
  { from: 'telegram',  to: 'notify' },
  { from: 'orderflow', to: 'runtime' },
  { from: 'orderflow', to: 'market' },
  { from: 'orderflow', to: 'eventstore' },
  { from: 'sentiment', to: 'runtime' },
  { from: 'sentiment', to: 'eventstore' },
  { from: 'news',      to: 'sentiment' },
  { from: 'news',      to: 'notify' },
]

const STATUS_INDICATORS: Record<string, string> = {
  Running: C.green, Active: C.green, Idle: C.yellow, Error: C.red, Paused: C.yellow,
}

const NODE_COLORS: Record<string, string> = {
  plugin:  C.accent,
  service: C.green,
  runtime: '#EAB308',
}

// ── Simple SVG layout (manual grid) ───────────────────────────────────
function layoutNodes(nodes: GraphNode[]) {
  const plugins = nodes.filter(n => n.type === 'plugin')
  const services = nodes.filter(n => n.type === 'service')
  const runtime = nodes.filter(n => n.type === 'runtime')
  return {
    plugins: plugins.map((n, i) => ({ ...n, x: 80, y: 40 + i * 70 })),
    services: services.map((n, i) => ({ ...n, x: 380, y: 40 + i * 60 })),
    runtime: runtime.map((n, i) => ({ ...n, x: 220, y: 20 + i * 50 })),
  }
}

// ── Dependencies ─────────────────────────────────────────────────────
export function Dependencies() {
  const [hovered, setHovered] = useState<string | null>(null)
  const { plugins, services, runtime } = layoutNodes(NODES)
  const all = [...plugins, ...services, ...runtime]

  const nodeMap = new Map(all.map(n => [n.id, n]))

  return (
    <div style={{ background: C.card, borderRadius: 6, border: `1px solid ${C.border}`, padding: 16 }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: NODE_COLORS.plugin }} />
          Plugin
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: NODE_COLORS.service }} />
          Service
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: NODE_COLORS.runtime }} />
          Runtime
        </span>
      </div>

      {/* SVG Graph */}
      <svg width="600" height={Math.max(plugins.length, services.length) * 70 + 80} style={{ overflow: 'visible' }}>
        {/* Edges */}
        {EDGES.map((edge, i) => {
          const from = all.find(n => n.id === edge.from)
          const to = all.find(n => n.id === edge.to)
          if (!from || !to) return null
          const highlighted = hovered === null || hovered === edge.from || hovered === edge.to
          return (
            <line
              key={i}
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke={highlighted ? C.border : C.input}
              strokeWidth={highlighted ? 1.5 : 0.5}
              strokeDasharray={from.type === 'plugin' && to.type === 'service' ? 'none' : '3,3'}
            />
          )
        })}

        {/* Nodes */}
        {all.map(n => {
          const highlighted = hovered === null || hovered === n.id
          return (
            <g
              key={n.id}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Node box */}
              <rect
                x={n.x - 60} y={n.y - 14}
                width={120} height={28} rx={6}
                fill={highlighted ? C.input : C.bg}
                stroke={hovered === n.id ? NODE_COLORS[n.type] : C.border}
                strokeWidth={hovered === n.id ? 2 : 1}
                opacity={highlighted ? 1 : 0.3}
              />
              {/* Status dot */}
              <circle
                cx={n.x - 48} cy={n.y}
                r={4}
                fill={STATUS_INDICATORS[n.status] || C.muted}
              />
              {/* Label */}
              <text
                x={n.x - 38} y={n.y + 4}
                fill={highlighted ? C.text : C.muted}
                fontSize={11} fontFamily="monospace"
              >
                {n.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
