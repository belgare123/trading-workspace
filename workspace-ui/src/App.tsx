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
import { registerBuiltInCommands } from './commands/builtin'
import { registerAllSearchAdapters } from './search/registerAdapters'
import { useCommands } from './commands/CommandProvider'
import { useStore } from './store'
import { useFeatureFlag } from './featureFlags'

const queryClient = new QueryClient()

// Register built-in commands and search adapters once
registerBuiltInCommands()
registerAllSearchAdapters()

// ── Global keyboard shortcut handler ───────────────────────────────

function GlobalKeyHandler() {
  const { togglePalette } = useCommands()
  const search = useSearch()
  const hotkeysEnabled = useFeatureFlag('workspace.hotkeys')
  const paletteEnabled = useFeatureFlag('workspace.commandPalette')
  const searchEnabled = useFeatureFlag('workspace.search')
  const timelineEnabled = useFeatureFlag('workspace.timeline')

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

      // Ctrl+[1-7] → navigation shortcuts
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
        return
      }

      // Ctrl+L → toggle timeline
      if (timelineEnabled && (e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault()
        useStore.getState().toggleTimeline()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePalette, search, hotkeysEnabled, paletteEnabled, searchEnabled, timelineEnabled])

  return null
}

// ── App ────────────────────────────────────────────────────────────

export default function App() {
  const paletteEnabled = useFeatureFlag('workspace.commandPalette')
  const searchEnabled = useFeatureFlag('workspace.search')

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <CommandProvider>
          <SearchProvider>
            <LayoutProvider>
              <NotificationProvider>
                <GlobalKeyHandler />
                <AppLayout>
                  <WorkspaceView />
                </AppLayout>
                <ToastContainer />
                {paletteEnabled && <CommandPalette />}
                {searchEnabled && <GlobalSearch />}
              </NotificationProvider>
            </LayoutProvider>
          </SearchProvider>
        </CommandProvider>
      </RealtimeProvider>
    </QueryClientProvider>
  )
}
