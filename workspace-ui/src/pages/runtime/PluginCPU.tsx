import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Plugin CPU data ──────────────────────────────────────────────────
interface PluginCPURow {
  name: string; cpu: number; mem: number; events: number; status: string
}

const PLUGINS: PluginCPURow[] = [
  { name: 'Signal Engine',  cpu: 18, mem: 42, events: 2842, status: 'Running' },
  { name: 'Heatmap',        cpu: 8,  mem: 18, events: 1345, status: 'Running' },
  { name: 'OrderFlow',      cpu: 6,  mem: 22, events: 892,  status: 'Error' },
  { name: 'News Sentiment', cpu: 4,  mem: 28, events: 634,  status: 'Running' },
  { name: 'Replay',         cpu: 3,  mem: 12, events: 156,  status: 'Running' },
  { name: 'Telegram',       cpu: 1,  mem: 8,  events: 89,   status: 'Idle' },
]

const STATUS_COLORS: Record<string, string> = {
  Running: C.green, Idle: C.yellow, Error: C.red, Disabled: C.muted, Paused: C.yellow,
}

// ── PluginCPU ────────────────────────────────────────────────────────
export function PluginCPU() {
  const [sort, setSort] = useState<'cpu' | 'mem' | 'events' | 'name'>('cpu')
  const [asc, setAsc] = useState(false)

  const sorted = [...PLUGINS].sort((a, b) => {
    const mul = asc ? 1 : -1
    if (sort === 'name') return mul * a.name.localeCompare(b.name)
    return mul * (a[sort] - b[sort])
  })

  const maxCpu = Math.max(...PLUGINS.map(p => p.cpu))
  const maxMem = Math.max(...PLUGINS.map(p => p.mem))

  const Sorter = ({ field, label }: { field: string; label: string }) => (
    <button
      onClick={() => {
        if (sort === field) setAsc(a => !a)
        else { setSort(field as typeof sort); setAsc(false) }
      }}
      style={{
        padding: '2px 6px', border: 'none', background: 'none',
        color: sort === field ? C.accent : C.muted,
        fontSize: 11, fontWeight: sort === field ? 700 : 400,
        cursor: 'pointer',
      }}
    >
      {label} {sort === field ? (asc ? '↑' : '↓') : ''}
    </button>
  )

  return (
    <div style={{
      background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
      padding: 12,
    }}>
      {/* Sort controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 11, color: C.muted }}>
        <span>Sort:</span>
        <Sorter field="cpu" label="CPU" />
        <Sorter field="mem" label="Memory" />
        <Sorter field="events" label="Events" />
        <Sorter field="name" label="Name" />
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map(p => (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Name */}
            <span style={{
              width: 120, fontSize: 12, fontFamily: 'monospace',
              color: C.text, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: STATUS_COLORS[p.status] || C.muted, flexShrink: 0,
              }} />
              {p.name}
            </span>

            {/* CPU bar */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                flex: 1, height: 8, borderRadius: 4, background: C.border,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(p.cpu / maxCpu) * 100}%`, height: '100%',
                  background: p.cpu > 10 ? C.accent : C.green,
                  borderRadius: 4, transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.text, minWidth: 30, textAlign: 'right' }}>
                {p.cpu}%
              </span>
            </div>

            {/* Mem */}
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted, minWidth: 50, textAlign: 'right' }}>
              {p.mem} MB
            </span>

            {/* Events */}
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted, minWidth: 50, textAlign: 'right' }}>
              {p.events}/s
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
