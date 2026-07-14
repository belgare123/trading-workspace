import { useState, useEffect } from 'react'
import { fetchSystemOverview } from '../api/system'
import type {
  SystemOverview,
  RuntimeService,
  ResourceMetrics,
  EventStoreMetrics,
  WebSocketMetrics,
  PluginRuntimeMetrics,
  TimelineEvent,
  Alert,
  HealthStatus,
} from '../types'

// ── Color palette ────────────────────────────────────────────────────

/** CSS variable references for semantic status colors. */
const C = (v: string) => `var(${v})`
const COLORS = {
  running: C('--c-success'),
  stopped: C('--c-danger'),
  error: C('--c-danger'),
  degraded: C('--c-warning'),
  healthy: C('--c-success'),
  critical: C('--c-danger'),
  idle: '#6b7280',
  paused: C('--c-warning'),
  textDim: C('--c-text-dim'),
  textMuted: C('--c-text-muted'),
  textSecondary: C('--c-text-secondary'),
  textPrimary: C('--c-text-primary'),
  surfaceInput: C('--c-surface-input'),
  chartUp: C('--c-chart-up'),
  chartDown: C('--c-chart-down'),
}

const STATUS_COLOR: Record<string, string> = {
  running: COLORS.running,
  stopped: COLORS.stopped,
  error: COLORS.error,
  degraded: COLORS.degraded,
  healthy: COLORS.healthy,
  critical: COLORS.critical,
  idle: COLORS.idle,
  paused: COLORS.paused,
}

// ── Sub-components ────────────────────────────────────────────────────

function ServiceRow({ service }: { service: RuntimeService }) {
  const dot = STATUS_COLOR[service.status] || STATUS_COLOR.stopped
  return (
    <div className="sys-row">
      <span style={{ color: dot, fontSize: 10, marginRight: 8 }}>●</span>
      <span className="sys-label">{service.name}</span>
      <span style={{ marginLeft: 'auto', fontSize: 12, color: dot, textTransform: 'capitalize' }}>{service.status}</span>
      <span style={{ marginLeft: 12, fontSize: 11, color: '#8892a4' }}>{service.version}</span>
    </div>
  )
}

function RuntimePanel({ services }: { services: RuntimeService[] }) {
  return (
    <div className="sys-card">
      <div className="sys-card-header">
        <span className="sys-card-icon">⚙️</span>
        <span className="sys-card-title">Runtime Services</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {services.map((s) => (
          <ServiceRow key={s.id} service={s} />
        ))}
      </div>
    </div>
  )
}

function ResourcesPanel({ data }: { data: ResourceMetrics }) {
  const bars = [
    { label: 'CPU', value: data.cpu_percent, max: 100, unit: '%' },
    { label: 'Memory', value: data.memory_percent, max: 100, unit: '%' },
    { label: 'SQLite', value: data.sqlite_size_mb, max: 200, unit: 'MB' },
  ]
  return (
    <div className="sys-card">
      <div className="sys-card-header">
        <span className="sys-card-icon">💻</span>
        <span className="sys-card-title">Resources</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {bars.map((b) => {
          const pct = Math.min((b.value / b.max) * 100, 100)
          const color = pct > 80 ? COLORS.chartDown : pct > 60 ? COLORS.degraded : COLORS.chartUp
          return (
            <div key={b.label}>
              <div className="sys-resource-label">
                <span>{b.label}</span>
                <span style={{ color: '#8892a4' }}>{b.value.toFixed(1)}{b.unit}</span>
              </div>
              <div className="sys-bar-track">
                <div className="sys-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          )
        })}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginTop: 4, fontSize: 12, color: '#8892a4' }}>
          <span>Threads: <strong style={{ color: '#e4e8ee' }}>{data.threads}</strong></span>
          <span>Open files: <strong style={{ color: '#e4e8ee' }}>{data.open_files}</strong></span>
        </div>
      </div>
    </div>
  )
}

function EventStorePanel({ data }: { data: EventStoreMetrics }) {
  const items = [
    { label: 'Events Today', value: data.total_events_today.toLocaleString(), large: true },
    { label: 'Append/s', value: data.append_per_second.toFixed(0), prefix: '~' },
    { label: 'Active Readers', value: data.active_readers },
    { label: 'Streams', value: data.stream_count },
    { label: 'Snapshots', value: data.snapshot_count },
    { label: 'Replay', value: data.replay_status, color: STATUS_COLOR[data.replay_status] || '#8892a4' },
    { label: 'Trace Queries', value: data.trace_queries },
  ]
  return (
    <div className="sys-card">
      <div className="sys-card-header">
        <span className="sys-card-icon">📦</span>
        <span className="sys-card-title">Event Store</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        {items.map((it) => (
          <div key={it.label}>
            <div style={{ fontSize: 11, color: '#8892a4', marginBottom: 2 }}>{it.label}</div>
            <div style={{ fontSize: it.large ? 20 : 16, fontWeight: 600, color: (it as any).color || '#e4e8ee' }}>
              {(it as any).prefix || ''}{it.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WebSocketsPanel({ data }: { data: WebSocketMetrics }) {
  return (
    <div className="sys-card">
      <div className="sys-card-header">
        <span className="sys-card-icon">🔌</span>
        <span className="sys-card-title">WebSockets</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#e4e8ee', marginBottom: 8 }}>{data.total_clients}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Object.entries(data.clients_by_channel).map(([ch, count]) => (
          <div key={ch} className="sys-row">
            <span className="sys-label" style={{ textTransform: 'capitalize' }}>{ch}</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: '#e4e8ee' }}>{count} clients</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PluginsPanel({ data }: { data: PluginRuntimeMetrics }) {
  const items = [
    { label: 'Installed', value: data.installed, color: '#e4e8ee' },
    { label: 'Enabled', value: data.enabled, color: '#22c55e' },
    { label: 'Disabled', value: data.disabled, color: data.disabled > 0 ? '#f59e0b' : '#8892a4' },
    { label: 'Errors', value: data.errors, color: data.errors > 0 ? '#ef4444' : '#22c55e' },
  ]
  return (
    <div className="sys-card">
      <div className="sys-card-header">
        <span className="sys-card-icon">🧩</span>
        <span className="sys-card-title">Plugin Runtime</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {items.map((it) => (
          <div key={it.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: it.color }}>{it.value}</div>
            <div style={{ fontSize: 11, color: '#8892a4' }}>{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="sys-card">
        <div className="sys-card-header">
          <span className="sys-card-icon">🔔</span>
          <span className="sys-card-title">Alerts</span>
        </div>
        <div style={{ color: '#22c55e', fontSize: 13 }}>✓ No active alerts</div>
      </div>
    )
  }
  return (
    <div className="sys-card">
      <div className="sys-card-header">
        <span className="sys-card-icon">🔔</span>
        <span className="sys-card-title">Alerts</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: alerts.filter(a => a.type === 'warning').length > 0 ? '#f59e0b' : '#8892a4' }}>
          {alerts.length} active
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {alerts.slice(0, 4).map((a) => (
          <div key={a.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 13, lineHeight: '16px' }}>{a.type === 'critical' ? '🔴' : a.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e4e8ee' }}>{a.title}</div>
              <div style={{ fontSize: 11, color: '#8892a4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</div>
            </div>
          </div>
        ))}
        {alerts.length > 4 && (
          <div style={{ fontSize: 11, color: '#5b8def', textAlign: 'right' }}>+{alerts.length - 4} more</div>
        )}
      </div>
    </div>
  )
}

function TimelinePanel({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="sys-card" style={{ gridColumn: '1 / -1' }}>
      <div className="sys-card-header">
        <span className="sys-card-icon">📋</span>
        <span className="sys-card-title">Timeline</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 280, overflowY: 'auto' }}>
        {events.slice(0, 12).map((ev) => {
          return (
            <div key={ev.id} className="sys-timeline-row">
              <span style={{ fontSize: 14, width: 24, textAlign: 'center' }}>{ev.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#e4e8ee' }}>{ev.title}</div>
                <div style={{ fontSize: 11, color: '#8892a4' }}>{ev.description}</div>
              </div>
              <span style={{ fontSize: 11, color: '#5b6a7a', whiteSpace: 'nowrap', marginLeft: 8 }}>{ev.timestamp.slice(11, 16)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HealthPanel({ health }: { health: HealthStatus }) {
  const score = health.overall_score
  const strokeColor = score >= 80 ? COLORS.chartUp : score >= 50 ? COLORS.degraded : COLORS.chartDown
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="sys-card" style={{ gridColumn: '1 / -1' }}>
      <div className="sys-card-header">
        <span className="sys-card-icon">❤️</span>
        <span className="sys-card-title">Overall Health</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            fontWeight: 600,
            color: strokeColor,
            textTransform: 'uppercase',
            padding: '2px 10px',
            borderRadius: 4,
            backgroundColor: strokeColor + '22',
          }}
        >
          {health.status}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        {/* SVG ring gauge */}
        <svg width={120} height={120} viewBox="0 0 120 120">
          <circle cx={60} cy={60} r={radius} fill="none" stroke="#1e293b" strokeWidth={8} />
          <circle
            cx={60}
            cy={60}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          <text x={60} y={56} textAnchor="middle" fill="#e4e8ee" fontSize={28} fontWeight={700}>
            {score}
          </text>
          <text x={60} y={74} textAnchor="middle" fill="#5b6a7a" fontSize={11}>
            /100
          </text>
        </svg>
        {/* Component breakdown */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
          {health.components.map((c) => {
            const cColor = c.status === 'healthy' ? COLORS.chartUp : c.status === 'degraded' ? COLORS.degraded : COLORS.chartDown
            return (
              <div key={c.name} className="sys-row" style={{ gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cColor, flexShrink: 0 }} />
                <span className="sys-label" style={{ textTransform: 'capitalize' }}>{c.name.replace('_', ' ')}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: cColor }}>{c.score}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton loader ──────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="sys-card" style={{ minHeight: 160 }}>
      <div className="sys-card-header">
        <span style={{ width: 120, height: 14, backgroundColor: '#1e293b', borderRadius: 4 }} />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <span style={{ width: '100%', height: 12, backgroundColor: '#1e293b', borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────

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
        if (!cancelled) {
          setOverview(data)
          setError(null)
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? 'Failed to load system overview')
      }
      if (!cancelled) {
        timer = setTimeout(poll, pollMs)
      }
    }

    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  if (error && !overview) {
    return (
      <div className="sys-page">
        <div className="sys-page-header">
          <h2>📊 System Monitor</h2>
        </div>
        <div style={{ color: '#ef4444', fontSize: 14, padding: 32, textAlign: 'center' }}>
          ⚠️ {error}
        </div>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="sys-page">
        <div className="sys-page-header">
          <h2>📊 System Monitor</h2>
        </div>
        <div className="sys-grid">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  const { services, resources, event_store, websockets, plugins, timeline, alerts, health } = overview

  return (
    <div className="sys-page">
      <div className="sys-page-header">
        <h2>📊 System Monitor</h2>
        <span style={{ fontSize: 12, color: '#8892a4' }}>
          Last updated: {new Date().toLocaleTimeString()} · Polling {pollMs / 1000}s
        </span>
      </div>
      <div className="sys-grid">
        <RuntimePanel services={services} />
        <ResourcesPanel data={resources} />
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
