import { useStore } from '../store'
import { Telemetry } from '../telemetry'

const NAV_ITEMS = [
  { id: 'scanner', label: 'Scanner', icon: '🔍' },
  { id: 'opportunities', label: 'Opportunities', icon: '🎯' },
  { id: 'strategies', label: 'Strategies', icon: '🧠' },
  { id: 'replay', label: 'Replay Studio', icon: '▶️' },
  { id: 'inspector', label: 'Inspector', icon: '🔬' },
  { id: 'plugins', label: 'Plugin Store', icon: '🧩' },
  { id: 'learning', label: 'Learning', icon: '🤖' },
  { id: 'system', label: 'System', icon: '📊' },
]

export function Nav() {
  const activeView = useStore((s) => s.activeView)
  const setActiveView = useStore((s) => s.setActiveView)

  return (
    <nav className="w-14 flex flex-col items-center gap-1 py-3 bg-nav-bg border-r border-border">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            Telemetry.viewChanged(item.id)
            setActiveView(item.id)
          }}
          className={`w-10 h-10 flex items-center justify-center rounded-lg text-lg transition-colors ${
            activeView === item.id
              ? 'bg-primary-500/20 text-primary-400'
              : 'text-surface-600 hover:text-surface-700 hover:bg-surface-300'
          }`}
          aria-label={item.label}
          aria-current={activeView === item.id ? 'page' : undefined}
          title={item.label}
        >
          {item.icon}
        </button>
      ))}
    </nav>
  )
}
