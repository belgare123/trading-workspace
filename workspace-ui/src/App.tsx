import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from './layouts/AppLayout'
import { WorkspaceView } from './components/WorkspaceView'
import { CommandPalette } from './components/CommandPalette'
import { GlobalSearch } from './components/GlobalSearch'
import { NotificationProvider, ToastContainer } from './notifications'
import { RealtimeProvider } from './realtime'
import { CommandProvider } from './commands'
import { SearchProvider, useSearch } from './search'
import { LayoutProvider } from './layouts'
import { PlatformBootstrap } from './runtime/PlatformBootstrap'
import {
  WorkspaceFoundationModule,
  OverviewModule,
  MarketsModule,
  SignalsModule,
  PortfolioModule,
  StrategiesModule,
  ReplayModule,
  LearningModule,
} from './runtime/modules'
import { useCommands } from './commands/CommandProvider'
import { useStore } from './store'
import { useFeatureFlag } from './featureFlags'

const queryClient = new QueryClient()

// ── Platform boot — single entry point ─────────────────────────────

const bootReport = PlatformBootstrap.initialize([
  WorkspaceFoundationModule,
  OverviewModule,
  MarketsModule,
  SignalsModule,
  PortfolioModule,
  StrategiesModule,
  ReplayModule,
  LearningModule,
])

if (import.meta.env.DEV && bootReport.validations.errors > 0) {
  console.warn(`[Platform] ⚠ ${bootReport.validations.errors} validation error(s)`)
}

// ── Global keyboard shortcut handler ───────────────────────────────

function GlobalKeyHandler() {
  const { togglePalette } = useCommands()
  const search = useSearch()
  const hotkeysEnabled = useFeatureFlag('workspace.hotkeys')
  const paletteEnabled = useFeatureFlag('workspace.commandPalette')
  const searchEnabled = useFeatureFlag('workspace.search')

  useEffect(() => {
    if (!hotkeysEnabled) return

    const handler = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K → toggle command palette
      if (paletteEnabled && (e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        togglePalette()
        return
      }

      // Ctrl+Shift+F / Cmd+Shift+F → toggle global search
      if (searchEnabled && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        if (search.isOpen) search.close()
        else search.open()
        return
      }

      // Ctrl+[1-8] → navigation shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '8') {
        e.preventDefault()
        const viewMap: Record<string, string> = {
          '1': 'scanner',
          '2': 'inspector',
          '3': 'strategies',
          '4': 'replay',
          '5': 'plugins',
          '6': 'learning',
          '7': 'system',
          '8': 'runtime',
        }
        const view = viewMap[e.key]
        if (view) {
          useStore.getState().setActiveView(view)
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [hotkeysEnabled, paletteEnabled, searchEnabled, togglePalette, search])

  return null
}

// ── App shell ──────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <RealtimeProvider>
          <CommandProvider>
            <SearchProvider>
              <LayoutProvider>
                <GlobalKeyHandler />
                <AppLayout>
                  <WorkspaceView />
                </AppLayout>
                <CommandPalette />
                <GlobalSearch />
                <ToastContainer />
              </LayoutProvider>
            </SearchProvider>
          </CommandProvider>
        </RealtimeProvider>
      </NotificationProvider>
    </QueryClientProvider>
  )
}
