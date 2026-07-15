import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSystemOverview } from '../../api/system'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { ErrorCard } from '../../components/ErrorCard'
import { SkeletonBlock } from '../../components/Skeleton'
import type { SystemOverview } from '../../types'

// ── Lazy-loaded sub-tabs ─────────────────────────────────────────────
const Installed = lazy(() => import('./Installed').then(m => ({ default: m.Installed })))
const Lifecycle = lazy(() => import('./Lifecycle').then(m => ({ default: m.Lifecycle })))
const Dependencies = lazy(() => import('./Dependencies').then(m => ({ default: m.Dependencies })))
const Permissions = lazy(() => import('./Permissions').then(m => ({ default: m.Permissions })))
const Sandbox = lazy(() => import('./Sandbox').then(m => ({ default: m.Sandbox })))
const Diagnostics = lazy(() => import('./Diagnostics').then(m => ({ default: m.Diagnostics })))
const ManifestViewer = lazy(() => import('./ManifestViewer').then(m => ({ default: m.ManifestViewer })))

// ── Tab definitions ──────────────────────────────────────────────────
const TABS = [
  { id: 'installed',    label: 'Installed',    badge: '24' },
  { id: 'lifecycle',    label: 'Lifecycle' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'permissions',  label: 'Permissions' },
  { id: 'sandbox',      label: 'Sandbox' },
  { id: 'diagnostics',  label: 'Diagnostics' },
  { id: 'manifest',     label: 'Manifest' },
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
export function PluginRuntime() {
  const [tab, setTab] = useState('installed')

  const { data: overview } = useQuery<SystemOverview>({
    queryKey: ['system-overview'],
    queryFn: fetchSystemOverview,
    refetchInterval: 10_000,
  })

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
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', border: 'none',
                background: active ? C.card : 'transparent',
                color: active ? C.text : C.muted,
                fontSize: 12, fontWeight: active ? 600 : 400,
                cursor: 'pointer', borderRadius: '6px 6px 0 0',
                borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
              }}
            >
              {t.label}
              {t.badge && (
                <span style={{
                  fontSize: 10, padding: '0 5px', borderRadius: 3,
                  background: C.accent + '22', color: C.accent,
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <ErrorBoundary fallback={<ErrorCard message="Plugin Runtime tab failed" icon="💥" />}>
          <Suspense fallback={<SkeletonBlock height={300} />}>
            {tab === 'installed'    && <Installed overview={overview} />}
            {tab === 'lifecycle'    && <Lifecycle />}
            {tab === 'dependencies' && <Dependencies />}
            {tab === 'permissions'  && <Permissions />}
            {tab === 'sandbox'      && <Sandbox />}
            {tab === 'diagnostics'  && <Diagnostics />}
            {tab === 'manifest'     && <ManifestViewer />}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}
