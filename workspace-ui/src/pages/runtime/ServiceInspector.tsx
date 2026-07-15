import { useMemo } from 'react'
import type { SystemOverview } from '../../types'

// ── Colours ──────────────────────────────────────────────────────────
const C = {
  bg:     '#0B0E14',
  card:   '#151922',
  border: '#1E2433',
  text:   '#E2E8F0',
  muted:  '#64748B',
  accent: '#3B82F6',
  green:  '#22C55E',
  red:    '#EF4444',
  yellow: '#EAB308',
  key:    '#818CF8',
  input:  '#0F131A',
}

const STATUS_COLORS: Record<string, string> = {
  running:  C.green,
  healthy:  C.green,
  stopped:  C.red,
  error:    C.red,
  degraded: C.yellow,
  idle:     C.muted,
  paused:   C.yellow,
}

function StatusDot({ status }: { status: string }) {
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
      background: STATUS_COLORS[status] || C.muted,
    }} />
  )
}

// ── Service Dependency DAG (simulated) ───────────────────────────────
const SERVICE_DEPENDENCIES: Record<string, string[]> = {
  'MarketService':     ['EventStore'],
  'ReplayService':     ['EventStore'],
  'StrategyService':   ['MarketService', 'EventStore', 'PortfolioService'],
  'PortfolioService':  ['RiskService', 'EventStore'],
  'RiskService':       ['EventStore'],
  'EventStore':        [],
  'MLService':         ['EventStore', 'MarketService'],
  'NotificationService': [],
  'PluginService':     ['EventStore'],
  'SearchService':     ['EventStore'],
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ── Service Inspector ────────────────────────────────────────────────
interface Props {
  overview?: SystemOverview
}

export function ServiceInspector({ overview }: Props) {
  const services = overview?.services ?? []
  const health   = overview?.health

  // Build service info with deps
  const serviceData = useMemo(() => {
    return services.map(s => ({
      ...s,
      dependencies: SERVICE_DEPENDENCIES[s.name] ?? [],
      dependents: services
        .filter(o => (SERVICE_DEPENDENCIES[o.name] ?? []).includes(s.name))
        .map(o => o.name),
    }))
  }, [services])

  if (services.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 13 }}>
        No service data available. Ensure the backend is running.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Health summary */}
      {health && (
        <div style={{
          display: 'flex', gap: 12, padding: '10px 14px',
          background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
          fontSize: 12,
        }}>
          <span style={{ color: C.muted }}>Overall Health:</span>
          <StatusDot status={health.status} />
          <span style={{
            fontWeight: 600,
            color: STATUS_COLORS[health.status] || C.text,
          }}>
            {health.status.toUpperCase()}
          </span>
          <span style={{ color: C.muted }}>Score:</span>
          <span style={{ color: C.text }}>{health.overall_score.toFixed(1)}%</span>
        </div>
      )}

      {/* Service cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 8 }}>
        {serviceData.map(s => (
          <div key={s.id} style={{
            background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StatusDot status={s.status} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
              </div>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4,
                background: (STATUS_COLORS[s.status] || C.muted) + '22',
                color: STATUS_COLORS[s.status] || C.muted,
                textTransform: 'uppercase', fontWeight: 500,
              }}>
                {s.status}
              </span>
            </div>

            {/* Info */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1px 12px',
              fontSize: 11, color: C.muted,
            }}>
              <span>Version</span>
              <span style={{ color: C.text, fontFamily: 'monospace' }}>{s.version}</span>
              <span>Uptime</span>
              <span style={{ color: C.text }}>{formatUptime(s.uptime_seconds)}</span>
              {s.port && (
                <>
                  <span>Port</span>
                  <span style={{ color: C.accent, fontFamily: 'monospace' }}>{s.port}</span>
                </>
              )}
              <span>PID</span>
              <span style={{ color: C.muted, fontFamily: 'monospace' }}>{s.pid}</span>
            </div>

            {/* Dependencies */}
            {s.dependencies.length > 0 && (
              <div style={{ fontSize: 11 }}>
                <span style={{ color: C.muted }}>Depends on: </span>
                <span style={{ color: C.key }}>
                  {s.dependencies.join(', ')}
                </span>
              </div>
            )}

            {/* Dependents */}
            {s.dependents.length > 0 && (
              <div style={{ fontSize: 11 }}>
                <span style={{ color: C.muted }}>Used by: </span>
                <span style={{ color: C.green }}>
                  {s.dependents.join(', ')}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
