import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Allocation categories ────────────────────────────────────────────
interface AllocCategory {
  name: string; count: number; bytes: number; growth: number; color: string
}

const CATEGORIES: AllocCategory[] = [
  { name: 'Events',       count: 8421,  bytes: 673680,   growth: 4.2, color: '#3B82F6' },
  { name: 'Signals',      count: 281,   bytes: 224800,   growth: 1.8, color: '#22C55E' },
  { name: 'Widget',       count: 124,   bytes: 198400,   growth: 0.3, color: '#EAB308' },
  { name: 'Replay',       count: 18,    bytes: 144000,   growth: 0,   color: '#A855F7' },
  { name: 'Orders',       count: 94,    bytes: 75200,    growth: 5.1, color: '#EF4444' },
  { name: 'Connections',  count: 26,    bytes: 20800,    growth: 0,   color: '#14B8A6' },
  { name: 'Other',        count: 412,   bytes: 164800,   growth: 1.2, color: '#64748B' },
]

const TOTAL_COUNT = CATEGORIES.reduce((s, c) => s + c.count, 0)
const TOTAL_BYTES = CATEGORIES.reduce((s, c) => s + c.bytes, 0)
const MAX_COUNT = Math.max(...CATEGORIES.map(c => c.count))

function formatBytes(b: number): string {
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB'
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KB'
  return b + ' B'
}

// ── AllocationInspector ──────────────────────────────────────────────
export function AllocationInspector() {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 250 }}>
      {/* Left: table */}
      <div style={{ flex: 1.5, background: C.card, borderRadius: 6, border: `1px solid ${C.border}`, padding: 12 }}>
        {/* Summary */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11, color: C.muted }}>
          <span>Total objects: <span style={{ color: C.text }}>{TOTAL_COUNT.toLocaleString()}</span></span>
          <span>Total bytes: <span style={{ color: C.text }}>{formatBytes(TOTAL_BYTES)}</span></span>
        </div>

        {/* Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 100px 120px 80px',
            padding: '4px 8px', fontSize: 10, color: C.muted, fontWeight: 600,
            borderBottom: `1px solid ${C.border}`,
          }}>
            <span>Category</span>
            <span style={{ textAlign: 'right' }}>Count</span>
            <span style={{ textAlign: 'right' }}>Size</span>
            <span style={{ textAlign: 'right' }}>Growth</span>
          </div>

          {CATEGORIES.map(c => {
            const isSel = selected === c.name
            return (
              <button
                key={c.name}
                onClick={() => setSelected(isSel ? null : c.name)}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 100px 120px 80px',
                  padding: '5px 8px', border: 'none', textAlign: 'left',
                  background: isSel ? C.input : 'transparent',
                  color: C.text, fontSize: 11, cursor: 'pointer', borderRadius: 3,
                  alignItems: 'center',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                  <span style={{ fontFamily: 'monospace' }}>{c.name}</span>
                </span>
                <span style={{
                  textAlign: 'right', fontFamily: 'monospace',
                  fontWeight: isSel ? 600 : 400,
                }}>
                  {c.count.toLocaleString()}
                </span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace', color: C.muted }}>
                  {formatBytes(c.bytes)}
                </span>
                <span style={{
                  textAlign: 'right', fontFamily: 'monospace',
                  color: c.growth > 3 ? C.red : c.growth > 1 ? C.yellow : C.green,
                }}>
                  +{c.growth}%
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: bar chart */}
      <div style={{
        flex: 1, background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
        padding: 12, display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>
          Objects by Category
        </div>
        {CATEGORIES.map(c => (
          <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 60, fontSize: 10, color: C.muted, textAlign: 'right' }}>{c.name}</span>
            <div style={{ flex: 1, height: 12, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
              <div style={{
                width: `${(c.count / MAX_COUNT) * 100}%`, height: '100%',
                background: c.color, borderRadius: 3, opacity: 0.8,
              }} />
            </div>
            <span style={{
              fontSize: 10, fontFamily: 'monospace', color: C.text, minWidth: 40, textAlign: 'right',
            }}>
              {c.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
