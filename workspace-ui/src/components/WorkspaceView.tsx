import { lazy, Suspense, useEffect, useState } from 'react'
import { useStore } from '../store'
import { ScreenRegistry } from '../runtime/dashboard/screen/ScreenRegistry'
import { DashboardShell } from '../runtime/dashboard/runtime/DashboardShell'
import { ScannerPage } from '../pages/ScannerPage'
import { LiveWorkspace } from '../pages/live/LiveWorkspace'
import { CampaignPage } from '../pages/CampaignPage'
import { ErrorBoundary } from './ErrorBoundary'
import { AsyncBoundary } from './AsyncBoundary'
import { ErrorCard } from './ErrorCard'
import { SkeletonBlock } from './Skeleton'

// ── Lazy-loaded pages (heavy, non-dashboard) ────────────────────────
const InspectorPage = lazy(() => import('../pages/InspectorPage').then(m => ({ default: m.InspectorPage })))
const PluginStorePage = lazy(() => import('../pages/PluginStorePage'))
const SystemMonitorPage = lazy(() => import('../pages/SystemMonitorPage'))

// ── Page transition ─────────────────────────────────────────────────

function PageTransition({ children, view }: { children: React.ReactNode; view: string }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(false)
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [view])

  return (
    <div style={{ height: '100%', overflow: 'auto' }} className={mounted ? 'page-enter-active' : 'page-enter'}>
      {children}
    </div>
  )
}

// ── Suspense fallback ───────────────────────────────────────────────

function PageSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<SkeletonBlock height={400} />}>{children}</Suspense>
}

// ── Fallback screens (no DashboardPreset yet) ───────────────────────

function renderFallback(view: string): React.ReactNode {
  switch (view) {
    case 'scanner':
      return <ScannerPage />
    case 'live':
      return <LiveWorkspace />
    case 'campaign':
      return <CampaignPage />
    case 'inspector':
      return <InspectorPage />
    case 'plugins':
      return <PluginStorePage />
    case 'system':
      return <SystemMonitorPage />
    default:
      return <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">Unknown view: {view}</div>
  }
}

// ── Workspace View ─────────────────────────────────────────────────

export function WorkspaceView() {
  const activeView = useStore((s) => s.activeView)

  const pageContent = () => {
    const screen = ScreenRegistry.get(activeView)

    // Screen registered with a DashboardPreset → render via DashboardShell
    if (screen?.preset) {
      return <DashboardShell preset={screen.preset} />
    }

    // Fallback to legacy page components
    return renderFallback(activeView)
  }

  return (
    <PageTransition view={activeView}>
      <ErrorBoundary
        fallback={
          <ErrorCard
            message="Page failed to render"
            description="An unexpected error occurred in this view. Try switching views or reload the app."
            icon="💥"
          />
        }
      >
        <AsyncBoundary
          loading={<SkeletonBlock height={400} />}
          isLoading={false}
          isError={false}
        >
          <PageSuspense>{pageContent()}</PageSuspense>
        </AsyncBoundary>
      </ErrorBoundary>
    </PageTransition>
  )
}
