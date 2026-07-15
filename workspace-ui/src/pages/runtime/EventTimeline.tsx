import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Timeline events ──────────────────────────────────────────────────
interface TimelineEvent {
  id: string; label: string; startMs: number; durMs: number; color: string
  detail?: string
}

const EVENTS: TimelineEvent[] = [
  { id: 'e1', label: 'Market Tick',     startMs: 0,   durMs: 0.8, color: '#3B82F6', detail: 'Price: 67234.50' },
  { id: 'e2', label: 'Indicators',      startMs: 0.8, durMs: 2.5, color: '#22C55E', detail: 'EMA(12/26) · RSI(14)' },
  { id: 'e3', label: 'Signal Builder',  startMs: 3.3, durMs: 1.2, color: '#EAB308', detail: 'Score: 0.82' },
  { id: 'e4', label: 'Consensus',       startMs: 4.5, durMs: 2.0, color: '#14B8A6', detail: '3/5 signals agree' },
  { id: 'e5', label: 'Risk Engine',     startMs: 6.5, durMs: 2.5, color: '#EF4444', detail: 'VaR: 2.3%' },
  { id: 'e6', label: 'Portfolio',       startMs: 9.0, durMs: 2.0, color: '#A855F7', detail: 'Allocation calc' },
  { id: 'e7', label: 'Order Builder',   startMs: 11.0, durMs: 1.5, color: '#F97316', detail: 'Size: 0.5 BTC' },
  { id: 'e8', label: 'Notification',    startMs: 12.5, durMs: 0.8, color: '#EC4899', detail: 'Signal alert sent' },
]

// ── EventTimeline ────────────────────────────────────────────────────
export function EventTimeline() {
  const [selected, setSelected] = useState<string | null>(null)

  const totalMs = EVENTS.reduce((max, e) => Math.max(max, e.startMs + e.durMs), 0)
  const scale = 600 / totalMs // px per ms

  return (
    <div style={{
      background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
      padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Time ruler */}
      <div style={{ position: 'relative', height: 20, marginLeft: 120 }}>
        <svg width="100%" height={20} viewBox={`0 0 620 20`}>
          {Array.from({ length: Math.ceil(totalMs / 2) + 1 }, (_, i) => (
            <g key={i}>
              <line x1={i * 2 * scale} y1={12} x2={i * 2 * scale} y2={16}
                stroke={C.muted} strokeWidth={0.5} />
              <text x={i * 2 * scale - 4} y={10}
                fill={C.muted} fontSize={8} fontFamily="monospace">
                {i * 2}ms
              </text>
            </g>
          ))}
          {/* End time */}
          <text x={totalMs * scale + 4} y={10}
            fill={C.muted} fontSize={8} fontFamily="monospace">
            {totalMs.toFixed(1)}ms
          </text>
        </svg>
      </div>

      {/* Event rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {EVENTS.map(e => {
          const x = 120 + e.startMs * scale
          const w = Math.max(e.durMs * scale, 6)
          const isSelected = selected === e.id

          return (
            <div key={e.id}
              onClick={() => setSelected(isSelected ? null : e.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '3px 0', cursor: 'pointer',
                borderRadius: 3, background: isSelected ? C.input : 'transparent',
                position: 'relative', height: 24,
              }}
            >
              {/* Label */}
              <span style={{
                width: 115, fontSize: 11, fontFamily: 'monospace', textAlign: 'right',
                color: C.muted, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {e.label}
              </span>

              {/* Bar */}
              <div style={{
                position: 'absolute', left: x, width: w, height: 16, borderRadius: 3,
                background: e.color,
                opacity: isSelected ? 1 : 0.75,
                transition: 'all 0.1s',
                display: 'flex', alignItems: 'center', paddingLeft: 4,
              }}>
                {w > 40 && (
                  <span style={{ fontSize: 9, color: '#fff', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {e.durMs}ms
                  </span>
                )}
              </div>

              {/* Detail */}
              {isSelected && e.detail && (
                <span style={{
                  position: 'absolute', left: x + w + 6, fontSize: 10,
                  color: C.accent, fontFamily: 'monospace', whiteSpace: 'nowrap',
                  lineHeight: '16px',
                }}>
                  {e.detail}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
