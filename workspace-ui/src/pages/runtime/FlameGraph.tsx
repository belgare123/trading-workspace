import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

const FLAME_COLORS = [
  '#3B82F6', '#22C55E', '#EAB308', '#EF4444', '#A855F7',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
]

// ── Flame graph nodes ────────────────────────────────────────────────
interface FlameNode {
  id: string; label: string; width: number; depth: number; offset: number
  color: string; children?: FlameNode[]
}

const FLAME_TREE: FlameNode = {
  id: 'root', label: 'Root', width: 100, depth: 0, offset: 0, color: '#1E293B',
  children: [
    { id: 'market-tick', label: 'Market Tick', width: 42, depth: 1, offset: 0, color: '#3B82F6',
      children: [
        { id: 'ema', label: 'Indicator EMA', width: 22, depth: 2, offset: 0, color: '#22C55E',
          children: [
            { id: 'signal-builder', label: 'Signal Builder', width: 14, depth: 3, offset: 0, color: '#EAB308',
              children: [
                { id: 'consensus', label: 'Consensus', width: 10, depth: 4, offset: 0, color: '#EF4444' },
              ],
            },
          ],
        },
        { id: 'rsi', label: 'Indicator RSI', width: 12, depth: 2, offset: 24, color: '#14B8A6' },
        { id: 'vol', label: 'Volume Spike', width: 8, depth: 2, offset: 38, color: '#A855F7' },
      ],
    },
    { id: 'strategy', label: 'Strategy Engine', width: 28, depth: 1, offset: 44, color: '#22C55E',
      children: [
        { id: 'risk', label: 'Risk Engine', width: 18, depth: 2, offset: 44, color: '#EAB308',
          children: [
            { id: 'order', label: 'Order Builder', width: 12, depth: 3, offset: 44, color: '#EF4444' },
          ],
        },
        { id: 'portfolio-calc', label: 'Portfolio', width: 10, depth: 2, offset: 62, color: '#6366F1' },
      ],
    },
    { id: 'notify', label: 'Notification', width: 12, depth: 1, offset: 74, color: '#EC4899' },
    { id: 'replay', label: 'Replay', width: 10, depth: 1, offset: 88, color: '#F97316' },
  ],
}

// ── Flatten tree for rendering ───────────────────────────────────────
function flatten(node: FlameNode, depth = 0): FlameNode[] {
  const result: FlameNode[] = []
  if (depth > 0) result.push(node)
  if (node.children) {
    for (const child of node.children) {
      result.push(...flatten(child, depth + 1))
    }
  }
  return result
}

// ── FlameGraph ───────────────────────────────────────────────────────
export function FlameGraph() {
  const [drillStack, setDrillStack] = useState<FlameNode[]>([FLAME_TREE])
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  const current = drillStack[drillStack.length - 1]

  const nodes = current.children
    ? current.children.reduce<FlameNode[]>((acc, n) => [...acc, n, ...(n.children ? flatten(n, 1) : [])], [])
    : []

  // Group by depth for layout
  const byDepth: Record<number, FlameNode[]> = {}
  for (const n of nodes) {
    if (!byDepth[n.depth]) byDepth[n.depth] = []
    byDepth[n.depth].push(n)
  }

  const maxDepth = Math.max(...Object.keys(byDepth).map(Number), 0)

  const WIDTH = 700
  const ROW_H = 26
  const PAD = 2

  const svgH = (maxDepth + 1) * (ROW_H + PAD) + 40

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'monospace' }}>
        {drillStack.map((n, i) => (
          <span key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={{ color: C.muted }}>↓</span>}
            {i < drillStack.length - 1 ? (
              <button
                onClick={() => setDrillStack(d => d.slice(0, i + 1))}
                style={{
                  padding: '2px 6px', border: 'none', background: C.input,
                  color: C.accent, borderRadius: 3, cursor: 'pointer', fontSize: 11,
                }}
              >
                {n.label}
              </button>
            ) : (
              <span style={{ color: C.text, fontWeight: 600 }}>{n.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* SVG Flame Chart */}
      <div style={{
        background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
        padding: 10, overflow: 'auto', flex: 1,
      }}>
        <svg width={WIDTH} height={Math.max(svgH, 300)} style={{ display: 'block' }}>
          {/* Y-axis labels */}
          {Array.from({ length: maxDepth + 1 }, (_, i) => (
            <text key={i} x={0} y={i * (ROW_H + PAD) + 14}
              fill={C.muted} fontSize={9} fontFamily="monospace">
              {i === 0 ? '' : `L${i}`}
            </text>
          ))}

          {/* Nodes */}
          {nodes.map((n, i) => {
            const x = (n.offset / 100) * WIDTH
            const w = (n.width / 100) * WIDTH
            const y = (n.depth - 1) * (ROW_H + PAD) + 24
            if (w < 2) return null

            return (
              <g key={n.id}
                onMouseEnter={(e) => {
                  const rect = (e.target as SVGElement).getBoundingClientRect()
                  setTooltip({ x: rect.left, y: rect.top - 30, text: `${n.label} (${n.width}%)` })
                }}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => {
                  if (n.children && n.children.length > 0) {
                    setDrillStack(s => [...s, n])
                  }
                }}
                style={{ cursor: n.children && n.children.length > 0 ? 'pointer' : 'default' }}
              >
                <rect
                  x={x} y={y} width={w - 2} height={ROW_H} rx={3}
                  fill={n.color}
                  opacity={0.85}
                />
                {w > 40 && (
                  <text x={x + 4} y={y + ROW_H / 2 + 4}
                    fill="#fff" fontSize={10} fontFamily="monospace" fontWeight={500}>
                    {n.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', top: tooltip.y, left: tooltip.x,
          padding: '4px 10px', background: '#000', color: C.text,
          fontSize: 11, borderRadius: 4, zIndex: 9999, pointerEvents: 'none',
        }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
