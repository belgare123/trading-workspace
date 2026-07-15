import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Sandbox data ─────────────────────────────────────────────────────
interface SandboxInstance {
  id: string; name: string; status: string
  cpu: number; mem: number; threads: number; eventsPerSec: number; openHandles: number
}

const SANDBOXES: SandboxInstance[] = [
  { id: 'sb-heatmap',     name: 'Heatmap',        status: 'Active',  cpu: 12, mem: 18,  threads: 4,  eventsPerSec: 54,  openHandles: 12 },
  { id: 'sb-signal',      name: 'Signal Engine',  status: 'Active',  cpu: 34, mem: 42,  threads: 8,  eventsPerSec: 128, openHandles: 24 },
  { id: 'sb-telegram',    name: 'Telegram',       status: 'Active',  cpu: 3,  mem: 8,   threads: 2,  eventsPerSec: 6,   openHandles: 5 },
  { id: 'sb-orderflow',   name: 'OrderFlow',      status: 'Halted',  cpu: 0,  mem: 22,  threads: 6,  eventsPerSec: 0,   openHandles: 18 },
  { id: 'sb-sentiment',   name: 'Sentiment',      status: 'Active',  cpu: 18, mem: 28,  threads: 5,  eventsPerSec: 41,  openHandles: 9 },
  { id: 'sb-news',        name: 'News Alerts',    status: 'Paused',  cpu: 1,  mem: 6,   threads: 1,  eventsPerSec: 0,   openHandles: 3 },
]

// ── Progress bar ─────────────────────────────────────────────────────
function Bar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div style={{ height: 4, borderRadius: 2, background: C.border, overflow: 'hidden', flex: 1 }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: 2,
        background: color ?? (pct > 80 ? C.red : pct > 50 ? C.yellow : C.green),
        transition: 'width 0.5s',
      }} />
    </div>
  )
}

// ── Sandbox ──────────────────────────────────────────────────────────
export function Sandbox() {
  const [selected, setSelected] = useState<string>('sb-heatmap')
  const sb = SANDBOXES.find(s => s.id === selected)

  return (
    <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 300 }}>
      {/* Left: sandbox list */}
      <div style={{ flex: 1, maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {SANDBOXES.map(s => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', border: 'none', textAlign: 'left',
              background: selected === s.id ? C.input : 'transparent',
              color: C.text, fontSize: 12, cursor: 'pointer', borderRadius: 4,
              border: `1px solid ${selected === s.id ? C.accent + '44' : 'transparent'}`,
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: s.status === 'Active' ? C.green
                : s.status === 'Halted' ? C.red
                : C.yellow,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: selected === s.id ? 600 : 400 }}>{s.name}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{s.status} · {s.cpu}% CPU</div>
            </div>
          </button>
        ))}
      </div>

      {/* Right: sandbox detail */}
      <div style={{
        flex: 2, background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
        padding: 14, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {!sb ? (
          <div style={{ color: C.muted, fontSize: 13 }}>Select a sandbox</div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{sb.name}</span>
                <span style={{
                  marginLeft: 8, fontSize: 10, padding: '2px 8px', borderRadius: 3,
                  background: sb.status === 'Active' ? C.green + '22'
                    : sb.status === 'Halted' ? C.red + '22'
                    : C.yellow + '22',
                  color: sb.status === 'Active' ? C.green
                    : sb.status === 'Halted' ? C.red
                    : C.yellow,
                  fontWeight: 500,
                }}>
                  {sb.status}
                </span>
              </div>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{sb.id}</span>
            </div>

            {/* Metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
              {/* CPU */}
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>CPU</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 20, fontWeight: 700, fontFamily: 'monospace',
                    color: sb.cpu > 60 ? C.yellow : C.text, minWidth: 50,
                  }}>
                    {sb.cpu}%
                  </span>
                  <Bar value={sb.cpu} max={100} />
                </div>
              </div>

              {/* Memory */}
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Memory</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: C.text, minWidth: 50,
                  }}>
                    {sb.mem} MB
                  </span>
                  <Bar value={sb.mem} max={100} color={C.accent} />
                </div>
              </div>

              {/* Threads */}
              <div style={{ padding: '8px 10px', background: C.input, borderRadius: 4, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.muted }}>Threads</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: C.accent }}>{sb.threads}</div>
              </div>

              {/* Events/sec */}
              <div style={{ padding: '8px 10px', background: C.input, borderRadius: 4, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.muted }}>Events/sec</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: sb.eventsPerSec > 0 ? C.green : C.muted }}>
                  {sb.eventsPerSec}
                </div>
              </div>

              {/* Open Handles */}
              <div style={{ padding: '8px 10px', background: C.input, borderRadius: 4, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.muted }}>Open Handles</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: C.yellow }}>{sb.openHandles}</div>
              </div>

              {/* Status badge */}
              <div style={{ padding: '8px 10px', background: C.input, borderRadius: 4, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.muted }}>Status</div>
                <div style={{
                  fontSize: 18, fontWeight: 700, fontFamily: 'monospace',
                  color: sb.status === 'Active' ? C.green : sb.status === 'Halted' ? C.red : C.yellow,
                }}>
                  {sb.status}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button style={{
                padding: '5px 14px', border: 'none', borderRadius: 4,
                background: C.red + '22', color: C.red, fontSize: 11, cursor: 'pointer',
              }}>
                Kill Sandbox
              </button>
              <button style={{
                padding: '5px 14px', border: 'none', borderRadius: 4,
                background: C.accent, color: '#fff', fontSize: 11, cursor: 'pointer',
              }}>
                Restart
              </button>
              <button style={{
                padding: '5px 14px', border: 'none', borderRadius: 4,
                background: C.input, color: C.muted, fontSize: 11, cursor: 'pointer',
                border: `1px solid ${C.border}`,
              }}>
                Collect Dump
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
