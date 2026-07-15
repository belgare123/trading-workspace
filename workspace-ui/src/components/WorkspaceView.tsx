import { lazy, Suspense, useEffect, useState } from 'react'
import { useStore } from '../store'
import { ScannerPage } from '../pages/ScannerPage'
import { ErrorBoundary } from './ErrorBoundary'
import { AsyncBoundary } from './AsyncBoundary'
import { ErrorCard } from './ErrorCard'
import { SkeletonBlock } from './Skeleton'

// ── Lazy-loaded pages (heavy) ───────────────────────────────────────
const InspectorPage = lazy(() => import('../pages/InspectorPage').then(m => ({ default: m.InspectorPage })))
const ReplayPage = lazy(() => import('../pages/ReplayPage').then(m => ({ default: m.ReplayPage })))
const StrategyPage = lazy(() => import('../pages/StrategyPage').then(m => ({ default: m.StrategyPage })))
const PluginStorePage = lazy(() => import('../pages/PluginStorePage'))
const LearningHubPage = lazy(() => import('../pages/LearningHubPage'))
const SystemMonitorPage = lazy(() => import('../pages/SystemMonitorPage'))
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const RuntimeDevTools = lazy(() => import('../pages/runtime/RuntimeDevTools').then(m => ({ default: m.RuntimeDevTools })))

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

// ── Suspense fallback per page type ──────────────────────────────────

function PageSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<SkeletonBlock height={400} />}>{children}</Suspense>
}

// ── Workspace View ──────────────────────────────────────────────────

export function WorkspaceView() {
  const activeView = useStore((s) => s.activeView)
  const dashboardPreset = useStore((s) => s.dashboardPreset)

  const pageContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardPage preset={dashboardPreset} />
      case 'scanner':
        return <ScannerPage />
      case 'opportunities':
        return <div className="text-surface-600 text-sm">Opportunities — coming in Phase 3</div>
      case 'strategies':
      case 'strategy':
        return <StrategyPage />
      case 'replay':
        return <ReplayPage />
      case 'inspector':
        return <InspectorPage />
      case 'runtime':
        return <RuntimeDevTools />
      case 'plugins':
        return <PluginStorePage />
      case 'learning':
        return <LearningHubPage />
      case 'system':
        return <SystemMonitorPage />
      default:
        return <ScannerPage />
    }
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
