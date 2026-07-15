import { useState } from 'react'
import type { SystemOverview } from '../../types'

// ── Colours ──────────────────────────────────────────────────────────
const C = {
  bg:     '#0B0E14',   card:   '#151922', border: '#1E2433',
  text:   '#E2E8F0',   muted:  '#64748B', accent: '#3B82F6',
  green:  '#22C55E',   red:    '#EF4444', yellow: '#EAB308',
  key:    '#818CF8',   input:  '#0F131A',
}

// ── Plugin data ──────────────────────────────────────────────────────
interface PluginRow {
  id: string; name: string; version: string; status: string; health: number
  category: string; author: string; manifest: Record<string, unknown>
}

const PLUGINS: PluginRow[] = [
  { id: 'signal-engine',  name: 'Signal Engine',  version: '2.1.0', status: 'Running',  health: 100, category: 'Strategy',     author: 'Core Team',      manifest: { type: 'strategy', entry: 'main.py', config: 'config.yaml', capabilities: ['market.read', 'event.read'], services: ['SignalBus'], widgets: ['HeatmapWidget'], commands: ['strategy.start', 'strategy.stop'], events: ['signal.created', 'signal.updated'] }},
  { id: 'heatmap',        name: 'Heatmap',        version: '1.3.4', status: 'Running',  health: 98,  category: 'Visualization', author: 'Community',     manifest: { type: 'widget', entry: 'index.js', config: 'settings.json', capabilities: ['market.read', 'widget.register'], services: [], widgets: ['HeatmapWidget'], commands: ['heatmap.toggle'], events: ['render.frame'] }},
  { id: 'telegram',       name: 'Telegram',       version: '1.0.2', status: 'Idle',     health: 95,  category: 'Messaging',    author: 'Core Team',      manifest: { type: 'connector', entry: 'bot.py', capabilities: ['notification.send', 'event.read'], services: ['TelegramBot'], widgets: [], commands: ['telegram.send'], events: ['message.received'] }},
  { id: 'discord',        name: 'Discord',        version: '0.9.0', status: 'Disabled', health: 0,   category: 'Messaging',    author: 'Community',     manifest: { type: 'connector', entry: 'main.js', capabilities: ['notification.send'], services: ['DiscordBot'], widgets: [], commands: ['discord.send'], events: [] }},
  { id: 'orderflow',      name: 'OrderFlow',      version: '3.0.0', status: 'Error',    health: 42,  category: 'Trading',      author: 'Core Team',      manifest: { type: 'strategy', entry: 'orderflow.py', capabilities: ['market.read', 'order.create', 'event.read'], services: ['OrderMatcher'], widgets: ['OrderFlowWidget'], commands: ['order.submit', 'order.cancel'], events: ['order.filled', 'order.rejected'] }},
  { id: 'news-sentiment', name: 'News Sentiment', version: '2.0.1', status: 'Running',  health: 91,  category: 'AI/ML',        author: 'Core Team',      manifest: { type: 'service', entry: 'sentiment.py', capabilities: ['event.read', 'market.read'], services: ['SentimentService'], widgets: ['SentimentWidget'], commands: ['sentiment.analyze'], events: ['sentiment.update'] }},
  { id: 'telegram-alerts',name: 'Telegram Alerts',version: '1.1.0', status: 'Paused',   health: 78,  category: 'Messaging',    author: 'Community',     manifest: { type: 'plugin', entry: 'alerts.py', capabilities: ['notification.send', 'event.read'], services: [], widgets: [], commands: ['alert.create'], events: ['alert.triggered'] }},
]

const STATUS_COLORS: Record<string, string> = {
  Running: C.green, Idle: C.yellow, Disabled: C.muted, Error: C.red, Paused: C.yellow,
}

// ── Installed ────────────────────────────────────────────────────────
export function Installed({ overview }: { overview?: SystemOverview }) {
  const [selected, setSelected] = useState<string>('signal-engine')
  const [detailTab, setDetailTab] = useState('manifest')

  const totalPlugins = overview?.plugins

  const plugin = PLUGINS.find(p => p.id === selected)

  // Detail panel subtabs
  const DETAIL_TABS = [
    { id: 'manifest',     label: 'Manifest' },
    { id: 'capabilities', label: 'Capabilities' },
    { id: 'services',     label: 'Services' },
    { id: 'widgets',      label: 'Widgets' },
    { id: 'commands',     label: 'Commands' },
    { id: 'events',       label: 'Events' },
    { id: 'logs',         label: 'Logs' },
  ]

  return (
    <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 400 }}>
      {/* ── Left: Table ────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 400, maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Summary bar */}
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted, padding: '4px 0' }}>
          <span>Installed: <span style={{ color: C.text }}>{PLUGINS.length}</span></span>
          <span>Running: <span style={{ color: C.green }}>{PLUGINS.filter(p => p.status === 'Running').length}</span></span>
          <span>Error: <span style={{ color: C.red }}>{PLUGINS.filter(p => p.status === 'Error').length}</span></span>
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 80px 90px 80px',
          padding: '6px 10px', fontSize: 11, color: C.muted, fontWeight: 600,
          borderBottom: `1px solid ${C.border}`, textTransform: 'uppercase',
        }}>
          <span>Name</span>
          <span>Version</span>
          <span>Status</span>
          <span>Health</span>
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {PLUGINS.map(p => {
            const isSel = selected === p.id
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 80px 90px 80px',
                  padding: '7px 10px', border: 'none', textAlign: 'left',
                  background: isSel ? '#1E293B' : 'transparent',
                  color: C.text, fontSize: 12, cursor: 'pointer',
                  borderBottom: `1px solid ${C.border}22`,
                  fontFamily: 'monospace', alignItems: 'center',
                  borderRadius: 4,
                }}
              >
                <span style={{ fontWeight: isSel ? 600 : 400 }}>{p.name}</span>
                <span style={{ color: C.muted }}>{p.version}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: STATUS_COLORS[p.status] || C.muted,
                  }} />
                  <span style={{ color: STATUS_COLORS[p.status] || C.text, fontSize: 11 }}>
                    {p.status}
                  </span>
                </span>
                <span style={{
                  color: p.health > 80 ? C.green : p.health > 50 ? C.yellow : C.red,
                  fontWeight: 600,
                }}>
                  {p.health > 0 ? `${p.health}%` : '—'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right: Detail panel ──────────────────────────────────── */}
      <div style={{
        flex: 1.5, display: 'flex', flexDirection: 'column',
        background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
        overflow: 'hidden',
      }}>
        {!plugin ? (
          <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 13 }}>
            Select a plugin to inspect
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: '8px 14px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: STATUS_COLORS[plugin.status],
                }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{plugin.name}</span>
                <span style={{ fontSize: 11, color: C.muted }}>v{plugin.version}</span>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 3,
                  background: C.accent + '22', color: C.accent,
                }}>{plugin.category}</span>
              </div>
              <span style={{ fontSize: 11, color: C.muted }}>{plugin.author}</span>
            </div>

            {/* Detail tabs */}
            <div style={{
              display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`,
              padding: '0 8px', fontSize: 11, flexWrap: 'wrap',
            }}>
              {DETAIL_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setDetailTab(t.id)}
                  style={{
                    padding: '5px 10px', border: 'none', background: 'none',
                    color: detailTab === t.id ? C.text : C.muted,
                    borderBottom: detailTab === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
                    cursor: 'pointer', fontWeight: detailTab === t.id ? 600 : 400,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px', fontSize: 12 }}>
              {detailTab === 'manifest' && (
                <ManifestContent manifest={plugin.manifest} />
              )}
              {detailTab === 'capabilities' && (
                <CapabilityContent manifest={plugin.manifest} />
              )}
              {detailTab === 'services' && (
                <ArrayContent items={plugin.manifest.services as string[]} empty="No services registered" />
              )}
              {detailTab === 'widgets' && (
                <ArrayContent items={plugin.manifest.widgets as string[]} empty="No widgets registered" />
              )}
              {detailTab === 'commands' && (
                <ArrayContent items={plugin.manifest.commands as string[]} empty="No commands registered" />
              )}
              {detailTab === 'events' && (
                <ArrayContent items={plugin.manifest.events as string[]} empty="No events subscribed" />
              )}
              {detailTab === 'logs' && (
                <LogContent pluginId={plugin.id} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────

function ManifestContent({ manifest }: { manifest: Record<string, unknown> }) {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6 }}>
      <span style={{ color: C.key }}>{'{'}</span>
      {Object.entries(manifest).map(([k, v], i, a) => (
        <div key={k} style={{ paddingLeft: 16, display: 'flex', gap: 4 }}>
          <span style={{ color: C.key }}>{k}:</span>
          {Array.isArray(v) ? (
            <span style={{ color: C.green }}>{'[' + (v as string[]).join(', ') + ']'}</span>
          ) : typeof v === 'string' ? (
            <span style={{ color: C.green }}>"{v}"</span>
          ) : (
            <span style={{ color: C.yellow }}>{String(v)}</span>
          )}
          {i < a.length - 1 && <span style={{ color: C.muted }}>,</span>}
        </div>
      ))}
      <span style={{ color: C.key }}>{'}'}</span>
    </div>
  )
}

function CapabilityContent({ manifest }: { manifest: Record<string, unknown> }) {
  const caps = (manifest.capabilities as string[]) ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {caps.length === 0 ? (
        <span style={{ color: C.muted }}>No capabilities requested</span>
      ) : (
        caps.map(c => (
          <div key={c} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 8px', background: C.input, borderRadius: 4,
            fontSize: 12, fontFamily: 'monospace',
          }}>
            <span style={{ color: C.green }}>✓</span>
            <span style={{ color: C.text }}>{c}</span>
          </div>
        ))
      )}
    </div>
  )
}

function ArrayContent({ items, empty }: { items: string[]; empty: string }) {
  if (!items || items.length === 0) {
    return <span style={{ color: C.muted }}>{empty}</span>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map(item => (
        <div key={item} style={{
          padding: '3px 8px', borderRadius: 3,
          background: C.input, fontSize: 11, fontFamily: 'monospace', color: C.accent,
        }}>
          {item}
        </div>
      ))}
    </div>
  )
}

function LogContent({ pluginId }: { pluginId: string }) {
  const logs: { time: string; level: string; msg: string }[] = [
    { time: '12:41:03', level: 'INFO',  msg: `${pluginId}: Plugin loaded successfully` },
    { time: '12:41:05', level: 'INFO',  msg: `${pluginId}: Connected to Event Bus` },
    { time: '12:42:12', level: 'WARN',  msg: `${pluginId}: Reconnect attempt 2/5` },
    { time: '12:43:00', level: 'INFO',  msg: `${pluginId}: Health check passed` },
    { time: '12:44:33', level: 'ERROR', msg: `${pluginId}: Timeout on service call` },
    { time: '12:45:01', level: 'INFO',  msg: `${pluginId}: Reconnected` },
    { time: '12:46:22', level: 'WARN',  msg: `${pluginId}: Memory usage 78%` },
  ]
  const LEVEL_COLORS: Record<string, string> = { INFO: C.accent, WARN: C.yellow, ERROR: C.red }
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {logs.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: C.muted }}>{l.time}</span>
          <span style={{ color: LEVEL_COLORS[l.level] || C.text, fontWeight: 500 }}>{l.level}</span>
          <span style={{ color: C.text }}>{l.msg}</span>
        </div>
      ))}
    </div>
  )
}
