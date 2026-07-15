import { useState, useEffect } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Live KPIs ────────────────────────────────────────────────────────
interface LiveMetric {
  label: string; value: string; unit: string; color: string; pct?: number
}

const METRICS: LiveMetric[] = [
  { label: 'CPU',      value: '21', unit: '%',  color: C.accent,  pct: 21 },
  { label: 'Memory',   value: '148', unit: 'MB', color: C.key,    pct: 38 },
  { label: 'FPS',      value: '60', unit: '',    color: C.green },
  { label: 'Events',   value: '2431', unit: '/s',color: C.accent },
  { label: 'WS',       value: '26', unit: '',    color: C.green },
  { label: 'Services', value: '14', unit: '',    color: C.yellow },
]

// ── Timeline data points ─────────────────────────────────────────────
const TIME_POINTS = [
  { t: '12:30', cpu: 18, mem: 142, evt: 2100 },
  { t: '12:31', cpu: 24, mem: 145, evt: 2350 },
  { t: '12:32', cpu: 31, mem: 148, evt: 2431 },
  { t: '12:33', cpu: 28, mem: 150, evt: 2280 },
  { t: '12:34', cpu: 21, mem: 148, evt: 2431 },
  { t: '12:35', cpu: 19, mem: 146, evt: 2150 },
  { t: '12:36', cpu: 22, mem: 147, evt: 2380 },
  { t: '12:37', cpu: 27, mem: 149, evt: 2410 },
  { t: '12:38', cpu: 35, mem: 152, evt: 2560 },
  { t: '12:39', cpu: 29, mem: 150, evt: 2480 },
  { t: '12:40', cpu: 21, mem: 148, evt: 2431 },
  { t: '12:41', cpu: 17, mem: 145, evt: 2080 },
]

// ── LivePerformance ──────────────────────────────────────────────────
export function LivePerformance() {
  const [tick, setTick] = useState(0)
  const [metrics, setMetrics] = useState(METRICS)

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // Jitter metrics on each tick
  const jittered = metrics.map(m => {
    if (m.label === 'FPS') return m
    const base = parseFloat(m.value)
    const delta = (Math.random() - 0.5) * (base * 0.15)
    return {
      ...m,
      value: delta > 0
        ? (base + delta).toFixed(m.label === 'Memory' || m.label === 'Events' ? 0 : 0)
        : (base + delta).toFixed(0),
      pct: m.pct ? Math.min(Math.max(Math.round(m.pct + (Math.random() - 0.5) * 8), 5), 95) : undefined,
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {jittered.map(m => (
          <div key={m.label} style={{
            background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
            padding: '10px 12px',
          }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{m.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: m.color }}>
                {m.value}
              </span>
              {m.unit && <span style={{ fontSize: 11, color: C.muted }}>{m.unit}</span>}
            </div>
            {m.pct !== undefined && (
              <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: C.border, overflow: 'hidden' }}>
                <div style={{ width: `${m.pct}%`, height: '100%', background: m.color, borderRadius: 2 }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Timeline trend */}
      <div style={{
        background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
        padding: 12,
      }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>
          Realtime Performance · <span style={{ color: C.accent }}>last 12 min</span>
        </div>

        <svg width="100%" height={100} viewBox="0 0 600 80" style={{ display: 'block' }}>
          {/* Grid lines */}
          {[0, 25, 50, 75].map(y => (
            <line key={y} x1={0} y1={y + 10} x2={600} y2={y + 10}
              stroke={C.border} strokeWidth={0.5} />
          ))}

          {/* CPU line */}
          <polyline
            points={TIME_POINTS.map((p, i) =>
              `${i * 50 + 10},${80 - (p.cpu / 40) * 60}`
            ).join(' ')}
            fill="none" stroke={C.accent} strokeWidth={2} strokeLinecap="round"
          />

          {/* Mem line */}
          <polyline
            points={TIME_POINTS.map((p, i) =>
              `${i * 50 + 10},${80 - ((p.mem - 140) / 20) * 60}`
            ).join(' ')}
            fill="none" stroke={C.key} strokeWidth={2} strokeLinecap="round"
          />

          {/* Event rate fill */}
          <polyline
            points={TIME_POINTS.map((p, i) =>
              `${i * 50 + 10},${80 - ((p.evt - 2000) / 600) * 60}`
            ).join(' ')}
            fill="none" stroke={C.green} strokeWidth={1.5} strokeLinecap="round"
            strokeDasharray="4,3"
          />

          {/* X labels */}
          {TIME_POINTS.filter((_, i) => i % 2 === 0).map((p, i) => (
            <text key={i} x={i * 100 + 10} y={78}
              fill={C.muted} fontSize={8} fontFamily="monospace">
              {p.t}
            </text>
          ))}
        </svg>

        <div style={{ display: 'flex', gap: 16, fontSize: 10, color: C.muted, marginTop: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 2, background: C.accent, display: 'inline-block' }} />
            CPU
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 2, background: C.key, display: 'inline-block' }} />
            Memory
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 2, background: C.green, display: 'inline-block', borderTop: '1px dashed' }} />
            Events
          </span>
        </div>
      </div>
    </div>
  )
}
