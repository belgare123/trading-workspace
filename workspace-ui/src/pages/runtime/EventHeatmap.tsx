import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Event types ──────────────────────────────────────────────────────
const EVENT_TYPES = ['market.tick', 'signal.created', 'order.filled', 'strategy.update', 'system.alert', 'plugin.event']

// ── Generate heatmap data (60 minutes × 6 types) ─────────────────────
function generateHeatmap() {
  const data: number[][] = []
  for (let min = 0; min < 60; min++) {
    const row: number[] = []
    for (const _ of EVENT_TYPES) {
      // Base rate + spikes
      const base = Math.random() * 50 + 10
      const spike = Math.random() > 0.9 ? Math.random() * 200 : 0
      row.push(Math.round(base + spike))
    }
    data.push(row)
  }
  return data
}

const HEATMAP = generateHeatmap()
const MAX_VAL = Math.max(...HEATMAP.flat())
const MIN_VAL = Math.min(...HEATMAP.flat())

function intensity(val: number): string {
  const pct = (val - MIN_VAL) / (MAX_VAL - MIN_VAL)
  if (pct < 0.15) return '#0A1628'
  if (pct < 0.3)  return '#1E3A5F'
  if (pct < 0.45) return '#2563EB33'
  if (pct < 0.6)  return '#2563EB55'
  if (pct < 0.75) return '#3B82F688'
  if (pct < 0.9)  return '#3B82F6BB'
  return '#3B82F6'
}

// ── EventHeatmap ─────────────────────────────────────────────────────
export function EventHeatmap() {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  const CELL_W = 10
  const CELL_H = 20
  const GAP = 1

  return (
    <div style={{
      background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
      padding: 12, overflow: 'auto',
    }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>
        Event Throughput · <span style={{ color: C.accent }}>last 60 min</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {/* Y-axis labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
          {EVENT_TYPES.map(t => (
            <div key={t} style={{
              height: CELL_H, display: 'flex', alignItems: 'center', fontSize: 10,
              fontFamily: 'monospace', color: C.muted, whiteSpace: 'nowrap',
            }}>
              {t}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
          {EVENT_TYPES.map((type, rowIdx) => (
            <div key={type} style={{ display: 'flex', gap: GAP }}>
              {Array.from({ length: 60 }, (_, colIdx) => {
                const val = HEATMAP[colIdx][rowIdx]
                return (
                  <div
                    key={colIdx}
                    style={{
                      width: CELL_W, height: CELL_H, borderRadius: 1,
                      background: intensity(val),
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      const rect = (e.target as HTMLElement).getBoundingClientRect()
                      setTooltip({
                        x: rect.left,
                        y: rect.top - 28,
                        text: `min ${colIdx}: ${type} — ${val} evt`,
                      })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Color scale */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: 10, color: C.muted }}>
        <span>Low</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((pct, i) => (
          <div key={i} style={{
            width: 20, height: 10, borderRadius: 2,
            background: intensity(MIN_VAL + pct * (MAX_VAL - MIN_VAL)),
          }} />
        ))}
        <span>High</span>
      </div>

      {tooltip && (
        <div style={{
          position: 'fixed', top: tooltip.y, left: tooltip.x,
          padding: '3px 8px', background: '#000', color: C.text,
          fontSize: 10, borderRadius: 3, zIndex: 9999, pointerEvents: 'none',
          fontFamily: 'monospace',
        }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
