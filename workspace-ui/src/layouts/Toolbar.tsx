import { useStore } from '../store'
import { LayoutSwitcher } from '../components/LayoutSwitcher'

export function Toolbar() {
  const toggleRightPanel = useStore((s) => s.toggleRightPanel)
  const rightPanelOpen = useStore((s) => s.rightPanelOpen)
  const activeView = useStore((s) => s.activeView)

  const viewLabels: Record<string, string> = {
    scanner: 'Scanner',
    opportunities: 'Opportunities',
    strategies: 'Strategies',
    replay: 'Replay Studio',
    inspector: 'Inspector',
    plugins: 'Plugin Store',
    learning: 'Learning Center',
    system: 'System Monitor',
  }

  return (
    <header className="h-10 flex items-center justify-between px-4 bg-toolbar-bg border-b border-border text-sm" role="toolbar" aria-label="Workspace toolbar">
      <div className="flex items-center gap-3">
        <span className="text-primary-400 font-semibold tracking-wide" aria-hidden="true">⚡ Workspace</span>
        <span className="text-surface-600" aria-hidden="true">/</span>
        <span className="text-surface-700">{viewLabels[activeView] || activeView}</span>
      </div>

      <div className="flex items-center gap-2">
        <LayoutSwitcher />
        <button
          onClick={toggleRightPanel}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            rightPanelOpen ? 'bg-primary-500/20 text-primary-400' : 'text-surface-600 hover:text-surface-700'
          }`}
          aria-label={rightPanelOpen ? 'Close right panel' : 'Open right panel'}
          aria-expanded={rightPanelOpen}
        >
          Panel
        </button>
      </div>
    </header>
  )
}
