import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Permission data ──────────────────────────────────────────────────
interface Permission {
  name: string; description: string; granted: boolean; critical: boolean
}

interface PluginPerms {
  plugin: string; status: string; permissions: Permission[]
}

const PLUGIN_PERMS: PluginPerms[] = [
  {
    plugin: 'Signal Engine', status: 'Running',
    permissions: [
      { name: 'market.read',        description: 'Read market data',          granted: true,  critical: true },
      { name: 'event.read',         description: 'Read event stream',         granted: true,  critical: false },
      { name: 'notification.send',  description: 'Send notifications',       granted: false, critical: false },
      { name: 'order.create',       description: 'Create buy/sell orders',   granted: true,  critical: true },
    ],
  },
  {
    plugin: 'Heatmap', status: 'Running',
    permissions: [
      { name: 'market.read',        description: 'Read market data',          granted: true,  critical: true },
      { name: 'widget.register',    description: 'Register UI widgets',      granted: true,  critical: true },
      { name: 'plugin.install',     description: 'Install other plugins',    granted: false, critical: true },
      { name: 'event.write',        description: 'Write to event stream',    granted: false, critical: false },
    ],
  },
  {
    plugin: 'Telegram', status: 'Idle',
    permissions: [
      { name: 'notification.send',  description: 'Send notifications',       granted: true,  critical: false },
      { name: 'event.read',         description: 'Read event stream',         granted: true,  critical: false },
      { name: 'user.message.send',  description: 'Send user-targeted msgs',  granted: false, critical: true },
    ],
  },
]

// ── Permissions ──────────────────────────────────────────────────────
export function Permissions() {
  const [selected, setSelected] = useState<string>('Signal Engine')
  const [permState, setPermState] = useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {}
    for (const p of PLUGIN_PERMS)
      for (const pm of p.permissions)
        s[pm.name] = pm.granted
    return s
  })

  const plugin = PLUGIN_PERMS.find(p => p.plugin === selected)
  if (!plugin) return null

  const togglePerm = (name: string) => {
    setPermState(prev => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 300 }}>
      {/* Left: plugin list */}
      <div style={{ flex: 1, maxWidth: 260, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {PLUGIN_PERMS.map(p => (
          <button
            key={p.plugin}
            onClick={() => setSelected(p.plugin)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', border: 'none', textAlign: 'left',
              background: selected === p.plugin ? C.input : 'transparent',
              color: C.text, fontSize: 12, cursor: 'pointer',
              borderRadius: 4,
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: p.status === 'Running' ? C.green : C.yellow,
            }} />
            <span style={{ fontWeight: selected === p.plugin ? 600 : 400 }}>{p.plugin}</span>
          </button>
        ))}
      </div>

      {/* Right: permission list */}
      <div style={{
        flex: 2, background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
        padding: 12,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          Permissions for <span style={{ color: C.accent }}>{plugin.plugin}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {plugin.permissions.map(p => {
            const granted = permState[p.name]
            return (
              <div key={p.name} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 12px', background: C.input, borderRadius: 6,
                border: `1px solid ${C.border}`,
              }}>
                {/* Icon */}
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: granted ? C.green + '22' : C.red + '22',
                  color: granted ? C.green : C.red,
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {granted ? '✓' : '✕'}
                </span>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, fontFamily: 'monospace', color: C.text,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {p.name}
                    {p.critical && (
                      <span style={{
                        fontSize: 9, padding: '1px 5px', borderRadius: 3,
                        background: C.yellow + '22', color: C.yellow,
                      }}>
                        CRITICAL
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                    {p.description}
                  </div>
                </div>

                {/* Toggle */}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => togglePerm(p.name)}
                    style={{
                      padding: granted ? '3px 12px' : '3px 10px',
                      border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                      background: granted ? C.green + '22' : C.red + '22',
                      color: granted ? C.green : C.red,
                      fontWeight: 500,
                    }}
                  >
                    {granted ? 'Granted' : 'Revoked'}
                  </button>
                  {!granted && (
                    <button
                      onClick={() => togglePerm(p.name)}
                      style={{
                        padding: '3px 12px', border: 'none', borderRadius: 4,
                        fontSize: 11, cursor: 'pointer',
                        background: C.accent, color: '#fff', fontWeight: 500,
                      }}
                    >
                      Grant
                    </button>
                  )}
                  {granted && (
                    <button
                      onClick={() => togglePerm(p.name)}
                      style={{
                        padding: '3px 12px', border: 'none', borderRadius: 4,
                        fontSize: 11, cursor: 'pointer',
                        background: C.muted + '22', color: C.muted, fontWeight: 500,
                      }}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
