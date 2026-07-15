import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Service call data ────────────────────────────────────────────────
interface ServiceNode {
  id: string; label: string; x: number; y: number
}
interface CallEdge {
  from: string; to: string; count: number; latencyMs: number
}

const NODES: ServiceNode[] = [
  { id: 'market',    label: 'Market Service',     x: 60,   y: 30 },
  { id: 'eventbus',  label: 'Event Bus',          x: 160,  y: 30 },
  { id: 'strategy',  label: 'Strategy Engine',    x: 280,  y: 30 },
  { id: 'risk',      label: 'Risk Engine',        x: 400,  y: 30 },
  { id: 'portfolio', label: 'Portfolio',          x: 520,  y: 30 },
  { id: 'notify',    label: 'Notification',       x: 520,  y: 80 },
  { id: 'signal-bus',label: 'Signal Bus',         x: 160,  y: 80 },
  { id: 'replay',    label: 'Replay Service',     x: 280,  y: 80 },
  { id: 'order',     label: 'Order Matcher',      x: 400,  y: 80 },
]

const EDGES: CallEdge[] = [
  { from: 'market',    to: 'eventbus',  count: 3842,  latencyMs: 0.8 },
  { from: 'eventbus',  to: 'strategy',  count: 2456,  latencyMs: 1.2 },
  { from: 'strategy',  to: 'risk',      count: 1821,  latencyMs: 2.5 },
  { from: 'risk',      to: 'portfolio', count: 924,   latencyMs: 1.8 },
  { from: 'portfolio', to: 'notify',    count: 412,   latencyMs: 0.5 },
  { from: 'eventbus',  to: 'signal-bus', count: 1532, latencyMs: 0.3 },
  { from: 'strategy',  to: 'replay',    count: 234,   latencyMs: 4.2 },
  { from: 'portfolio', to: 'order',     count: 186,   latencyMs: 3.1 },
  { from: 'risk',      to: 'order',     count: 512,   latencyMs: 1.5 },
]

function latencyColor(ms: number): string {
  if (ms < 1) return '#22C55E'
  if (ms < 2) return '#EAB308'
  if (ms < 3) return '#F97316'
  return '#EF4444'
}

function strokeWidth(cnt: number): number {
  return Math.max(1, Math.min(6, cnt / 400))
}

// ── ServiceCallGraph ─────────────────────────────────────────────────
export function ServiceCallGraph() {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div style={{
      background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
      padding: 16,
    }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11 }}>
        <span style={{ color: C.muted }}>Thickness = call count</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 2, background: '#22C55E', display: 'inline-block' }} />
          &lt;1ms
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 2, background: '#EAB308', display: 'inline-block' }} />
          1-2ms
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 2, background: '#F97316', display: 'inline-block' }} />
          2-3ms
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 2, background: '#EF4444', display: 'inline-block' }} />
          &gt;3ms
        </span>
      </div>

      <svg width={640} height={130}>
        {/* Edges */}
        {EDGES.map((e, i) => {
          const from = NODES.find(n => n.id === e.from)
          const to = NODES.find(n => n.id === e.to)
          if (!from || !to) return null

          const hl = hovered === null || hovered === e.from || hovered === e.to

          return (
            <g key={i}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={hl ? latencyColor(e.latencyMs) : C.bg}
                strokeWidth={hl ? strokeWidth(e.count) : 0.5}
                opacity={hl ? 0.85 : 0.15}
                strokeLinecap="round"
              />
              {/* Edge label */}
              {hl && (
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 4}
                  fill={C.muted} fontSize={8}
                  textAnchor="middle" fontFamily="monospace"
                >
                  {e.count} calls
                </text>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {NODES.map(n => (
          <g key={n.id}
            onMouseEnter={() => setHovered(n.id)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}
          >
            <rect x={n.x - 50} y={n.y - 14} width={100} height={28} rx={6}
              fill={C.input} stroke={hovered === n.id ? C.accent : C.border}
              strokeWidth={hovered === n.id ? 2 : 1}
            />
            <text x={n.x} y={n.y + 4} fill={C.text} fontSize={10}
              textAnchor="middle" fontFamily="monospace" fontWeight={500}>
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
