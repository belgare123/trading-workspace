import { lazy, Suspense, useState } from 'react'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { ErrorCard } from '../../components/ErrorCard'
import { SkeletonBlock } from '../../components/Skeleton'

// ── Lazy-loaded sub-tabs ─────────────────────────────────────────────
const LivePerformance = lazy(() => import('./LivePerformance').then(m => ({ default: m.LivePerformance })))
const FlameGraph = lazy(() => import('./FlameGraph').then(m => ({ default: m.FlameGraph })))
const EventTimeline = lazy(() => import('./EventTimeline').then(m => ({ default: m.EventTimeline })))
const ServiceCallGraph = lazy(() => import('./ServiceCallGraph').then(m => ({ default: m.ServiceCallGraph })))
const MemoryTimeline = lazy(() => import('./MemoryTimeline').then(m => ({ default: m.MemoryTimeline })))
const EventHeatmap = lazy(() => import('./EventHeatmap').then(m => ({ default: m.EventHeatmap })))
const PluginCPU = lazy(() => import('./PluginCPU').then(m => ({ default: m.PluginCPU })))
const LatencyHistogram = lazy(() => import('./LatencyHistogram').then(m => ({ default: m.LatencyHistogram })))
const AllocationInspector = lazy(() => import('./AllocationInspector').then(m => ({ default: m.AllocationInspector })))
const Recording = lazy(() => import('./Recording').then(m => ({ default: m.Recording })))

// ── Tab definitions ──────────────────────────────────────────────────
const TABS = [
  { id: 'live',   label: 'Live Performance', icon: '●' },
  { id: 'flame',  label: 'Flame Graph',      icon: '🔥' },
  { id: 'timeline', label: 'Event Timeline', icon: '⏱' },
  { id: 'calls',  label: 'Service Calls',    icon: '↗' },
  { id: 'memory', label: 'Memory Timeline',  icon: '🧠' },
  { id: 'heatmap', label: 'Event Heatmap',   icon: '🌡' },
  { id: 'cpu',    label: 'Plugin CPU',       icon: '⚡' },
  { id: 'latency',label: 'Latency Histogram',icon: '📊' },
  { id: 'alloc',  label: 'Allocation',       icon: '📦' },
  { id: 'record', label: 'Recording',        icon: '⏺' },
]

// ── Colours ──────────────────────────────────────────────────────────
const C = {
  bg:     '#0B0E14',
  card:   '#151922',
  border: '#1E2433',
  text:   '#E2E8F0',
  muted:  '#64748B',
  accent: '#3B82F6',
}

// ── Component ────────────────────────────────────────────────────────
export function ProfilerStudio() {
  const [tab, setTab] = useState('live')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex', gap: 2, borderBottom: `1px solid ${C.border}`,
        marginBottom: 12, flexWrap: 'wrap',
      }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', border: 'none',
                background: active ? C.card : 'transparent',
                color: active ? C.text : C.muted,
                fontSize: 11, fontWeight: active ? 600 : 400,
                cursor: 'pointer', borderRadius: '6px 6px 0 0',
                borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 12 }}>{t.icon}</span>
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <ErrorBoundary fallback={<ErrorCard message="Profiler Studio tab failed" icon="💥" />}>
          <Suspense fallback={<SkeletonBlock height={300} />}>
            {tab === 'live'    && <LivePerformance />}
            {tab === 'flame'   && <FlameGraph />}
            {tab === 'timeline' && <EventTimeline />}
            {tab === 'calls'   && <ServiceCallGraph />}
            {tab === 'memory'  && <MemoryTimeline />}
            {tab === 'heatmap' && <EventHeatmap />}
            {tab === 'cpu'     && <PluginCPU />}
            {tab === 'latency' && <LatencyHistogram />}
            {tab === 'alloc'   && <AllocationInspector />}
            {tab === 'record'  && <Recording />}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}
