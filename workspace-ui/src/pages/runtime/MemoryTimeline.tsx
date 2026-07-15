import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Memory data points ───────────────────────────────────────────────
const DATA = [
  { t: '12:30', heap: 142, rss: 164 },
  { t: '12:31', heap: 145, rss: 168 },
  { t: '12:32', heap: 148, rss: 171 },
  { t: '12:33', heap: 150, rss: 174 },
  { t: '12:34', heap: 148, rss: 172 },
  { t: '12:35', heap: 146, rss: 170 },
  { t: '12:36', heap: 147, rss: 169 },
  { t: '12:37', heap: 149, rss: 173 },
  { t: '12:38', heap: 152, rss: 176 },
  { t: '12:39', heap: 150, rss: 174 },
  { t: '12:40', heap: 148, rss: 172 },
  { t: '12:41', heap: 145, rss: 168 },
]

// ── Snapshots ────────────────────────────────────────────────────────
interface Snapshot {
  time: string; heapMB: number; objects: number
}

// ── MemoryTimeline ───────────────────────────────────────────────────
export function MemoryTimeline() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [hoverX, setHoverX] = useState<number | null>(null)

  const W = 600, H = 180, PAD = 30
  const minMem = 120, maxMem = 190

  const addSnapshot = () => {
    const latest = DATA[DATA.length - 1]
    setSnapshots(prev => [...prev, {
      time: latest.t,
      heapMB: latest.heap,
      objects: Math.round(124000 + Math.random() * 12000),
    }])
  }

  return (
    <div style={{
      background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
      padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
          Memory · <span style={{ color: C.accent }}>{DATA[DATA.length - 1].heap} MB</span>
        </span>
        <button onClick={addSnapshot}
          style={{
            padding: '3px 10px', border: 'none', borderRadius: 3,
            background: C.accent + '22', color: C.accent,
            fontSize: 11, cursor: 'pointer', fontWeight: 500,
          }}
        >
          + Take Snapshot
        </button>
      </div>

      {/* SVG Chart */}
      <svg width="100%" height={H + 20} viewBox={`0 0 ${W} ${H + 20}`}>
        {/* Grid */}
        {Array.from({ length: 7 }, (_, i) => {
          const val = minMem + (maxMem - minMem) * (1 - i / 6)
          const y = PAD + (i / 6) * (H - PAD * 2)
          return (
            <g key={i}>
              <line x1={0} y1={y} x2={W} y2={y} stroke={C.border} strokeWidth={0.5} />
              <text x={W - 2} y={y + 3} fill={C.muted} fontSize={8} textAnchor="end">
                {Math.round(val)} MB
              </text>
            </g>
          )
        })}

        {/* Heap fill */}
        <polygon
          points={DATA.map((d, i) =>
            `${(i / (DATA.length - 1)) * W + 10},${PAD + (1 - (d.heap - minMem) / (maxMem - minMem)) * (H - PAD * 2)}`
          ).join(' ') + ` ${W - (W - 10)} ${H - PAD} ${10} ${H - PAD}`}
          fill={C.accent + '22'}
        />

        {/* Heap line */}
        <polyline
          points={DATA.map((d, i) =>
            `${(i / (DATA.length - 1)) * W + 10},${PAD + (1 - (d.heap - minMem) / (maxMem - minMem)) * (H - PAD * 2)}`
          ).join(' ')}
          fill="none" stroke={C.accent} strokeWidth={2} strokeLinecap="round"
        />

        {/* RSS line */}
        <polyline
          points={DATA.map((d, i) =>
            `${(i / (DATA.length - 1)) * W + 10},${PAD + (1 - (d.rss - minMem) / (maxMem - minMem)) * (H - PAD * 2)}`
          ).join(' ')}
          fill="none" stroke={C.key} strokeWidth={1.5} strokeLinecap="round"
          strokeDasharray="4,3"
        />

        {/* Data points */}
        {DATA.map((d, i) => (
          <circle key={i}
            cx={(i / (DATA.length - 1)) * W + 10}
            cy={PAD + (1 - (d.heap - minMem) / (maxMem - minMem)) * (H - PAD * 2)}
            r={2.5} fill={C.accent} opacity={0.6}
          />
        ))}

        {/* X labels */}
        {DATA.filter((_, i) => i % 2 === 0).map((d, i) => (
          <text key={i}
            x={(i * 2 / (DATA.length - 1)) * W + 10} y={H - PAD + 14}
            fill={C.muted} fontSize={8} textAnchor="middle" fontFamily="monospace">
            {d.t}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: 10, color: C.muted }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 2, background: C.accent, display: 'inline-block' }} />
          Heap Used
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 2, background: C.key, display: 'inline-block', borderTop: '1px dashed' }} />
          RSS
        </span>
      </div>

      {/* Snapshots */}
      {snapshots.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>Snapshots</div>
          {snapshots.map((s, i) => (
            <div key={i} style={{
              display: 'flex', gap: 16, padding: '3px 8px',
              background: C.input, borderRadius: 3, fontSize: 11, fontFamily: 'monospace',
            }}>
              <span style={{ color: C.muted }}>{s.time}</span>
              <span style={{ color: C.accent }}>{s.heapMB} MB</span>
              <span style={{ color: C.key }}>{s.objects.toLocaleString()} objects</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
