import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSystemOverview } from '../../api/system'
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
}

// ── Metric Card ──────────────────────────────────────────────────────
function MetricCard({
  label, value, unit, sub, color,
}: {
  label: string; value: string | number; unit?: string; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 11, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{
          fontSize: 24, fontWeight: 700, fontFamily: 'monospace',
          color: color ?? C.text,
        }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span style={{ fontSize: 12, color: C.muted }}>{unit}</span>
        )}
      </div>
      {sub && (
        <span style={{ fontSize: 11, color: C.muted }}>{sub}</span>
      )}
    </div>
  )
}

// ── Progress Bar ─────────────────────────────────────────────────────
function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div style={{
      height: 4, borderRadius: 2, background: C.border, overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: 2,
        background: color ?? (pct > 80 ? C.red : pct > 60 ? C.yellow : C.green),
        transition: 'width 0.5s',
      }} />
    </div>
  )
}

// ── Runtime Metrics ──────────────────────────────────────────────────
export function RuntimeMetrics({ overview }: { overview?: SystemOverview }) {
  const { data: fresh } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: fetchSystemOverview,
    refetchInterval: 10_000,
    initialData: overview,
  })

  const data = fresh ?? overview
  const r = data?.resources
  const es = data?.event_store
  const ws = data?.websockets
  const pl = data?.plugins

  const servicesHealthy = useMemo(() => {
    if (!data?.services) return 0
    return data.services.filter(s => s.status === 'running').length
  }, [data])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top row: big metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {/* Event Bus */}
        <MetricCard
          label="Event Bus"
          value={es?.append_per_second ?? '—'}
          unit="evt/s"
          sub={`${(es?.total_events_today ?? 0).toLocaleString()} today`}
          color={C.accent}
        />
        {/* Commands */}
        <MetricCard
          label="Commands / Trades"
          value={es?.trace_queries ?? '—'}
          unit="/min"
          sub="trace queries"
        />
        {/* Services */}
        <MetricCard
          label="Services"
          value={data?.services?.length ?? '—'}
          unit={`${servicesHealthy} running`}
          color={servicesHealthy === data?.services?.length ? C.green : C.yellow}
        />
        {/* Plugins */}
        <MetricCard
          label="Plugins"
          value={pl?.installed ?? '—'}
          unit={`${pl?.enabled ?? 0} enabled`}
        />
        {/* WebSocket */}
        <MetricCard
          label="WebSocket"
          value={ws?.total_clients ?? '—'}
          unit="clients"
        />
        {/* Memory */}
        <MetricCard
          label="Memory"
          value={r?.memory_mb ?? '—'}
          unit="MB"
          sub={`${r?.memory_percent?.toFixed(1) ?? '—'}% of total`}
          color={r && r.memory_percent > 80 ? C.red : C.text}
        />
        {/* CPU */}
        <MetricCard
          label="CPU"
          value={r?.cpu_percent ?? '—'}
          unit="%"
          sub={`${r?.threads ?? '—'} threads`}
          color={r && r.cpu_percent > 80 ? C.red : r && r.cpu_percent > 50 ? C.yellow : C.text}
        />
      </div>

      {/* Resource bars */}
      {r && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: C.card, borderRadius: 6, border: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>System Resources</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: C.muted }}>CPU</span>
                <span style={{ color: C.text }}>{r.cpu_percent.toFixed(1)}%</span>
              </div>
              <ProgressBar value={r.cpu_percent} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: C.muted }}>Memory</span>
                <span style={{ color: C.text }}>{r.memory_percent.toFixed(1)}%</span>
              </div>
              <ProgressBar value={r.memory_percent} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: C.muted }}>Open Files</span>
                <span style={{ color: C.text }}>{r.open_files}</span>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: C.muted }}>SQLite DB</span>
                <span style={{ color: C.text }}>{r.sqlite_size_mb} MB</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WebSocket channels */}
      {ws && ws.clients_by_channel && Object.keys(ws.clients_by_channel).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', background: C.card, borderRadius: 6, border: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>WebSocket Channels</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(ws.clients_by_channel).map(([ch, count]) => (
              <div key={ch} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', background: C.bg, borderRadius: 4,
                fontSize: 11, border: `1px solid ${C.border}`,
              }}>
                <span style={{ color: C.accent, fontFamily: 'monospace' }}>/{ch}</span>
                <span style={{ color: C.text }}>{count}</span>
                <span style={{ color: C.muted }}>clients</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
