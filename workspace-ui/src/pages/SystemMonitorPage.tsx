import { useState, useEffect } from 'react'
import { Activity, Server, Database, Wifi, Puzzle, Clock, Bell, Heart } from 'lucide-react'
import { fetchSystemOverview } from '../api/system'
import type {
  SystemOverview, RuntimeService, ResourceMetrics, EventStoreMetrics,
  WebSocketMetrics, PluginRuntimeMetrics, TimelineEvent, Alert, HealthStatus,
} from '../types'

const COLORS = {
  running: 'var(--green)',
  healthy: 'var(--green)',
  error: 'var(--red)',
  degraded: 'var(--yellow)',
  stopped: 'var(--red)',
  critical: 'var(--red)',
  idle: 'var(--text-muted)',
  paused: 'var(--yellow)',
} as const

function StatusDot({ status }: { status: string }) {
  const color = (COLORS as Record<string, string>)[status] || 'var(--text-muted)'
  return <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />
}

function Section({ icon, title, children, gridSpan }: { icon: React.ReactNode; title: string; children: React.ReactNode; gridSpan?: string }) {
  return (
    <div className="glass-card" style={gridSpan ? { gridColumn: gridSpan } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function RuntimeServices({ services }: { services: RuntimeService[] }) {
  return (
    <Section icon={<Server size={14} />} title="Runtime Services">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {services.map((s) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <StatusDot status={s.status} />
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{s.name}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: (COLORS as Record<string, string>)[s.status] || 'var(--text-muted)', textTransform: 'capitalize' }}>{s.status}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.version}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function Resources({ data }: { data: ResourceMetrics }) {
  const bars = [
    { label: 'CPU', value: data.cpu_percent, max: 100, unit: '%' },
    { label: 'Memory', value: data.memory_percent, max: 100, unit: '%' },
    { label: 'SQLite', value: data.sqlite_size_mb, max: 200, unit: 'MB' },
  ]
  return (
    <Section icon={<Activity size={14} />} title="Resources">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {bars.map((b) => {
          const pct = Math.min((b.value / b.max) * 100, 100)
          const barColor = pct > 80 ? 'var(--red)' : pct > 60 ? 'var(--yellow)' : 'var(--green)'
          return (
            <div key={b.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-sec)' }}>{b.label}</span>
                <span style={{ color: 'var(--text-muted)' }}>{b.value.toFixed(1)}{b.unit}</span>
              </div>
              <div style={{ height: 4, background: 'var(--surface)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: 2, transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )
        })}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>Threads: <strong style={{ color: 'var(--text)' }}>{data.threads}</strong></span>
          <span>Open files: <strong style={{ color: 'var(--text)' }}>{data.open_files}</strong></span>
        </div>
      </div>
    </Section>
  )
}

function EventStorePanel({ data }: { data: EventStoreMetrics }) {
  const items = [
    { label: 'Events Today', value: data.total_events_today.toLocaleString(), large: true },
    { label: 'Append/s', value: `~${data.append_per_second.toFixed(0)}` },
    { label: 'Active Readers', value: data.active_readers },
    { label: 'Streams', value: data.stream_count },
    { label: 'Snapshots', value: data.snapshot_count },
    { label: 'Replay', value: data.replay_status, status: true },
    { label: 'Trace Queries', value: data.trace_queries },
  ]
  return (
    <Section icon={<Database size={14} />} title="Event Store">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        {items.map((it) => (
          <div key={it.label}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{it.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {'status' in it && <StatusDot status={String(it.value).toLowerCase()} />}
              <span style={{ fontSize: it.large ? 20 : 16, fontWeight: 600, color: 'var(--text)' }}>{it.value}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function WebSocketsPanel({ data }: { data: WebSocketMetrics }) {
  return (
    <Section icon={<Wifi size={14} />} title="WebSockets">
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{data.total_clients}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Object.entries(data.clients_by_channel).map(([ch, count]) => (
          <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
            <span style={{ fontSize: 13, color: 'var(--text-sec)', textTransform: 'capitalize' }}>{ch}</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{count} clients</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function PluginsPanel({ data }: { data: PluginRuntimeMetrics }) {
  const items = [
    { label: 'Installed', value: data.installed, color: 'var(--text)' },
    { label: 'Enabled', value: data.enabled, color: 'var(--green)' },
    { label: 'Disabled', value: data.disabled, color: data.disabled > 0 ? 'var(--yellow)' : 'var(--text-muted)' },
    { label: 'Errors', value: data.errors, color: data.errors > 0 ? 'var(--red)' : 'var(--green)' },
  ]
  return (
    <Section icon={<Puzzle size={14} />} title="Plugin Runtime">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {items.map((it) => (
          <div key={it.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: it.color }}>{it.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{it.label}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <Section icon={<Bell size={14} />} title="Alerts">
        <div style={{ color: 'var(--green)', fontSize: 13 }}>✓ No active alerts</div>
      </Section>
    )
  }
  return (
    <Section icon={<Bell size={14} />} title="Alerts">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {alerts.slice(0, 4).map((a) => (
          <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 14, lineHeight: '18px' }}>{a.type === 'critical' ? '🔴' : a.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{a.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</div>
            </div>
          </div>
        ))}
        {alerts.length > 4 && <div style={{ fontSize: 11, color: 'var(--primary)', textAlign: 'right' }}>+{alerts.length - 4} more</div>}
      </div>
    </Section>
  )
}

function TimelinePanel({ events }: { events: TimelineEvent[] }) {
  const totalToday = events.length
  const signalsCount = events.filter(e => e.title?.toLowerCase().includes('signal')).length
  const tradesCount = events.filter(e => e.title?.toLowerCase().includes('trade') || e.title?.toLowerCase().includes('close')).length
  const systemCount = totalToday - signalsCount - tradesCount
  const items = [
    { label: 'Events', value: totalToday, color: 'var(--text)' },
    { label: 'Signals', value: signalsCount, color: 'var(--green)' },
    { label: 'Trades', value: tradesCount, color: signalsCount > 0 ? 'var(--primary)' : 'var(--text-muted)' },
    { label: 'System', value: systemCount, color: 'var(--text-muted)' },
  ]
  return (
    <Section icon={<Clock size={14} />} title="Timeline">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        {items.map((it) => (
          <div key={it.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: it.color }}>{it.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{it.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto' }}>
        {events.slice(0, 8).map((ev) => (
          <div key={ev.id} style={{ display: 'flex', gap: 8, padding: '4px 0', alignItems: 'center' }}>
            <span style={{ fontSize: 14, width: 24, textAlign: 'center' }}>{ev.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{ev.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.description}</div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{ev.timestamp.slice(11, 16)}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function HealthPanel({ health }: { health: HealthStatus }) {
  const { overall_score: score, components } = health
  const scoreColor = score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--yellow)' : 'var(--red)'
  const healthy = components.filter(c => c.status === 'healthy').length
  const degraded = components.filter(c => c.status === 'degraded').length
  const critical = components.filter(c => c.status === 'critical').length
  const items = [
    { label: 'Score', value: score, color: scoreColor },
    { label: 'Healthy', value: healthy, color: 'var(--green)' },
    { label: 'Degraded', value: degraded, color: degraded > 0 ? 'var(--yellow)' : 'var(--text-muted)' },
    { label: 'Critical', value: critical, color: critical > 0 ? 'var(--red)' : 'var(--text-muted)' },
  ]
  return (
    <Section icon={<Heart size={14} />} title="Overall Health">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {items.map((it) => (
          <div key={it.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: it.color }}>{it.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{it.label}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function SkeletonCard() {
  return (
    <div className="glass-card" style={{ minHeight: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 14, height: 14, backgroundColor: 'var(--surface)', borderRadius: 4 }} />
        <div style={{ width: 100, height: 14, backgroundColor: 'var(--surface)', borderRadius: 4 }} />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ width: '100%', height: 12, backgroundColor: 'var(--surface)', borderRadius: 4, marginBottom: 8 }} />
      ))}
    </div>
  )
}

export default function SystemMonitorPage() {
  const [overview, setOverview] = useState<SystemOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollMs = 5000

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function poll() {
      try {
        const data = await fetchSystemOverview()
        if (!cancelled) { setOverview(data); setError(null) }
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? 'Failed to load')
      }
      if (!cancelled) timer = setTimeout(poll, pollMs)
    }
    poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  if (error && !overview) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>System Monitor</h2>
        <div style={{ color: 'var(--red)', fontSize: 14, padding: 32, textAlign: 'center' }}>⚠️ {error}</div>
      </div>
    )
  }

  if (!overview) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>System Monitor</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    )
  }

  const { services, resources, event_store, websockets, plugins, timeline, alerts, health } = overview

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>System Monitor</h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Last updated: {new Date().toLocaleTimeString()} · Polling {pollMs / 1000}s
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        <RuntimeServices services={services} />
        <Resources data={resources} />
        <EventStorePanel data={event_store} />
        <WebSocketsPanel data={websockets} />
        <PluginsPanel data={plugins} />
        <AlertsPanel alerts={alerts} />
        <TimelinePanel events={timeline} />
        <HealthPanel health={health} />
      </div>
    </div>
  )
}
