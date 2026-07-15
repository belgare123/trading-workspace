import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Pipeline stages ──────────────────────────────────────────────────
interface Stage {
  id: string; label: string; status: 'done' | 'active' | 'pending' | 'error'
  details: { ok: boolean; label: string; detail?: string }[]
}

const PIPELINE: Stage[] = [
  { id: 'install',
    label: 'Install',
    status: 'done',
    details: [
      { ok: true, label: 'Package downloaded' },
      { ok: true, label: 'Checksum verified' },
      { ok: true, label: 'Extracted to sandbox' },
    ],
  },
  { id: 'validate',
    label: 'Validate Manifest',
    status: 'done',
    details: [
      { ok: true, label: 'Manifest format valid' },
      { ok: true, label: 'Plugin ID unique' },
      { ok: true, label: 'Version format valid' },
    ],
  },
  { id: 'resolve',
    label: 'Resolve Dependencies',
    status: 'error',
    details: [
      { ok: true, label: 'Runtime Kernel', detail: '≥1.2.0 ✓' },
      { ok: true, label: 'Market Service', detail: '≥2.0.0 ✓' },
      { ok: false, label: 'market-api', detail: '≥2.0.0 — Missing' },
      { ok: true, label: 'Event Store', detail: '≥1.5.0 ✓' },
    ],
  },
  { id: 'capability',
    label: 'Capability Check',
    status: 'active',
    details: [
      { ok: true, label: 'market.read' },
      { ok: true, label: 'event.read' },
      { ok: true, label: 'notification.send' },
      { ok: false, label: 'plugin.install', detail: 'Requires admin approval' },
    ],
  },
  { id: 'sandbox',
    label: 'Sandbox',
    status: 'pending',
    details: [
      { ok: false, label: 'Allocating sandbox resources...' },
    ],
  },
  { id: 'activate',
    label: 'Activate',
    status: 'pending',
    details: [
      { ok: false, label: 'Runtime initialized' },
      { ok: false, label: 'Widget registered' },
      { ok: false, label: 'Commands registered' },
      { ok: false, label: 'Ready' },
    ],
  },
]

// ── Lifecycle ────────────────────────────────────────────────────────
export function Lifecycle() {
  const [expandedStage, setExpandedStage] = useState<string>('resolve')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 640 }}>
      {PIPELINE.map((stage, idx) => {
        const expanded = expandedStage === stage.id

        return (
          <div key={stage.id} style={{ display: 'flex', gap: 16 }}>
            {/* Left: connector + dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
              {/* Dot */}
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                background: stage.status === 'done' ? C.green
                  : stage.status === 'active' ? C.accent
                  : stage.status === 'error' ? C.red
                  : C.muted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, color: C.bg, fontWeight: 700,
              }}>
                {stage.status === 'done' ? '✓' : stage.status === 'error' ? '✕' : ''}
              </div>
              {/* Connector line */}
              {idx < PIPELINE.length - 1 && (
                <div style={{
                  flex: 1, width: 2,
                  background: stage.status === 'done' ? C.green
                    : stage.status === 'error' ? C.red
                    : C.border,
                  margin: '2px 0',
                }} />
              )}
            </div>

            {/* Right: content */}
            <div style={{ flex: 1, paddingBottom: idx < PIPELINE.length - 1 ? 8 : 0 }}>
              <button
                onClick={() => setExpandedStage(expanded ? '' : stage.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', border: 'none',
                  background: stage.status === 'error' ? '#EF4444' + '15'
                    : stage.status === 'active' ? C.accent + '15'
                    : C.card,
                  color: stage.status === 'done' ? C.green
                    : stage.status === 'error' ? C.red
                    : stage.status === 'active' ? C.accent
                    : C.muted,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  borderRadius: 4, width: '100%', textAlign: 'left',
                }}
              >
                {stage.status === 'done' && <span style={{ color: C.green }}>✔</span>}
                {stage.status === 'error' && <span style={{ color: C.red }}>✕</span>}
                {stage.status === 'active' && <span style={{ color: C.accent }}>●</span>}
                {stage.status === 'pending' && <span style={{ color: C.muted }}>○</span>}
                {stage.label}
                <span style={{ fontSize: 10, color: C.muted, fontWeight: 400, marginLeft: 8 }}>
                  {expanded ? '▲' : '▼'}
                </span>
              </button>

              {expanded && (
                <div style={{
                  marginTop: 4, marginLeft: 4, padding: '6px 10px',
                  borderLeft: `2px solid ${C.border}`,
                  display: 'flex', flexDirection: 'column', gap: 3,
                }}>
                  {stage.details.map((d, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 11, fontFamily: 'monospace',
                    }}>
                      <span style={{ color: d.ok ? C.green : C.muted, flexShrink: 0 }}>
                        {d.ok ? '✔' : '○'}
                      </span>
                      <span style={{
                        color: d.ok ? C.text : d.detail?.includes('Missing') ? C.red : C.yellow,
                      }}>
                        {d.label}
                      </span>
                      {d.detail && (
                        <span style={{
                          color: d.detail.includes('Missing') ? C.red
                            : d.detail.includes('admin') ? C.yellow
                            : C.muted,
                          fontSize: 10,
                        }}>
                          — {d.detail}
                        </span>
                      )}
                      {!d.ok && d.detail?.includes('Missing') && (
                        <button
                          onClick={(e) => { e.stopPropagation() }}
                          style={{
                            marginLeft: 'auto', padding: '2px 8px',
                            background: C.accent + '22', color: C.accent,
                            border: 'none', borderRadius: 3, fontSize: 10,
                            cursor: 'pointer',
                          }}
                        >
                          Resolve →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
