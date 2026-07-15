import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Histogram buckets ────────────────────────────────────────────────
interface Bucket {
  label: string; count: number; pct: number; color: string
}

const BUCKETS: Bucket[] = [
  { label: '0-0.5ms', count: 12432, pct: 42, color: '#22C55E' },
  { label: '0.5-1ms', count: 8934,  pct: 30, color: '#22C55E' },
  { label: '1-2ms',   count: 4123,  pct: 14, color: '#EAB308' },
  { label: '2-5ms',   count: 2134,  pct: 7,  color: '#F97316' },
  { label: '5-10ms',  count: 1267,  pct: 4,  color: '#EF4444' },
  { label: '10ms+',   count: 892,   pct: 3,  color: '#EF4444' },
]

const MAX_PCT = Math.max(...BUCKETS.map(b => b.pct))

// ── LatencyHistogram ─────────────────────────────────────────────────
export function LatencyHistogram() {
  const [showLog, setShowLog] = useState(false)

  return (
    <div style={{
      background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
      padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
          Event Latency Distribution · <span style={{ color: C.accent }}>29,782 samples</span>
        </span>
        <button onClick={() => setShowLog(s => !s)}
          style={{
            padding: '2px 8px', border: 'none', borderRadius: 3,
            background: C.input, color: C.muted, fontSize: 10, cursor: 'pointer',
          }}
        >
          {showLog ? 'Linear' : 'Log'}
        </button>
      </div>

      {/* Bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 180, paddingBottom: 20 }}>
        {BUCKETS.map((b, i) => {
          const h = showLog
            ? Math.max(4, (Math.log10(b.count + 1) / Math.log10(12432 + 1)) * 160)
            : (b.pct / MAX_PCT) * 160

          return (
            <div key={i} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', height: '100%', justifyContent: 'flex-end',
            }}>
              {/* Count label */}
              <span style={{
                fontSize: 10, fontFamily: 'monospace', color: C.muted,
                marginBottom: 3,
              }}>
                {b.count.toLocaleString()}
              </span>

              {/* Bar */}
              <div style={{
                width: '80%', height: h, borderRadius: '3px 3px 0 0',
                background: b.color,
                opacity: 0.8,
                transition: 'height 0.2s',
                position: 'relative',
              }}>
                {/* Pct label in bar */}
                {h > 30 && (
                  <span style={{
                    position: 'absolute', top: 4, left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 10, fontWeight: 700, color: '#fff',
                  }}>
                    {b.pct}%
                  </span>
                )}
              </div>

              {/* Label */}
              <span style={{
                fontSize: 10, color: C.muted, marginTop: 4, textAlign: 'center',
              }}>
                {b.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
