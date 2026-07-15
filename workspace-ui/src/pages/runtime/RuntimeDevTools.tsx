import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSystemOverview } from '../../api/system'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { ErrorCard } from '../../components/ErrorCard'
import { SkeletonBlock } from '../../components/Skeleton'
import type { SystemOverview } from '../../types'

// ── Lazy-loaded tabs ────────────────────────────────────────────────
const EventInspector = lazy(() =>
  import('./EventInspector').then(m => ({ default: m.EventInspector }))
)
const ServiceInspector = lazy(() =>
  import('./ServiceInspector').then(m => ({ default: m.ServiceInspector }))
)
const RuntimeMetrics = lazy(() =>
  import('./RuntimeMetrics').then(m => ({ default: m.RuntimeMetrics }))
)
const WidgetInspector = lazy(() =>
  import('./WidgetInspector').then(m => ({ default: m.WidgetInspector }))
)
const PluginRuntime = lazy(() =>
  import('./PluginRuntime').then(m => ({ default: m.PluginRuntime }))
)
const ProfilerStudio = lazy(() =>
  import('./ProfilerStudio').then(m => ({ default: m.ProfilerStudio }))
)

// ── Tab definitions ─────────────────────────────────────────────────
interface TabDef {
  id: string
  label: string
  badge?: string | number
}

const TABS: TabDef[] = [
  { id: 'events',    label: 'Event Inspector',    badge: 'live' },
  { id: 'services',  label: 'Service Inspector' },
  { id: 'metrics',   label: 'Runtime Metrics' },
  { id: 'widgets',   label: 'Widget Inspector' },
  { id: 'plugins',   label: 'Plugin Runtime',    badge: 'v2.0' },
  { id: 'profiler',  label: 'Profiler Studio',   badge: 'studio' },
]

// ── Colours ──────────────────────────────────────────────────────────
const COLORS = {
  bg:     '#0B0E14',
  card:   '#151922',
  border: '#1E2433',
  text:   '#E2E8F0',
  muted:  '#64748B',
  accent: '#3B82F6',
}

// ── Component ────────────────────────────────────────────────────────
export function RuntimeDevTools() {
  const [tab, setTab] = useState('events')

  const { data: overview } = useQuery<SystemOverview>({
    queryKey: ['system-overview'],
    queryFn: fetchSystemOverview,
    refetchInterval: 10_000,
  })

  const serviceCount = overview?.services.length ?? '—'
  const eventRate   = overview?.event_store.append_per_second ?? '—'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      padding: 20, height: '100%', background: COLORS.bg, color: COLORS.text,
    }}>
      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: COLORS.text }}>
            Runtime DevTools
          </h1>
          <p style={{ fontSize: 12, color: COLORS.muted, margin: '2px 0 0 0' }}>
            Event rate: <span style={{ color: COLORS.accent }}>{eventRate}/s</span>
            {' · '}Services: <span style={{ color: COLORS.accent }}>{serviceCount}</span>
          </p>
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 2, borderBottom: `1px solid ${COLORS.border}`,
        paddingBottom: 0,
      }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', border: 'none',
                background: active ? COLORS.card : 'transparent',
                color: active ? COLORS.text : COLORS.muted,
                fontSize: 13, fontWeight: active ? 600 : 400,
                cursor: 'pointer', borderRadius: '6px 6px 0 0',
                borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
              {t.badge && (
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 4,
                  background: t.badge === 'live' ? '#22C55E22' : COLORS.accent + '22',
                  color: t.badge === 'live' ? '#22C55E' : COLORS.accent,
                  fontWeight: 500,
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <ErrorBoundary
          fallback={
            <ErrorCard message="Tab failed to render" icon="💥" />
          }
        >
          <Suspense fallback={<SkeletonBlock height={300} />}>
            {tab === 'events'   && <EventInspector />}
            {tab === 'services' && <ServiceInspector overview={overview} />}
            {tab === 'metrics'  && <RuntimeMetrics overview={overview} />}
            {tab === 'widgets'  && <WidgetInspector />}
            {tab === 'plugins'  && <PluginRuntime />}
            {tab === 'profiler' && <ProfilerStudio />}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}
