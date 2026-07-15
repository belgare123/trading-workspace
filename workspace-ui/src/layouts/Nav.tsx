import { LayoutDashboard, Search, Target, BrainCircuit, Play, SearchCheck, Cpu, Puzzle, BookOpen, Monitor } from 'lucide-react'
import { useStore } from '../store'
import { Telemetry } from '../telemetry'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scanner', label: 'Scanner', icon: Search },
  { id: 'opportunities', label: 'Opportunities', icon: Target },
  { id: 'strategies', label: 'Strategies', icon: BrainCircuit },
  { id: 'replay', label: 'Replay Studio', icon: Play },
  { id: 'inspector', label: 'Inspector', icon: SearchCheck },
  { id: 'runtime', label: 'Runtime', icon: Cpu },
  { id: 'plugins', label: 'Plugin Store', icon: Puzzle },
  { id: 'learning', label: 'Learning', icon: BookOpen },
  { id: 'system', label: 'System', icon: Monitor },
]

export function Nav() {
  const activeView = useStore((s) => s.activeView)
  const setActiveView = useStore((s) => s.setActiveView)

  return (
    <nav className="sidebar" role="navigation" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            onClick={() => {
              Telemetry.viewChanged(item.id)
              setActiveView(item.id)
            }}
            className={`sidebar-btn${activeView === item.id ? ' active' : ''}`}
            aria-label={item.label}
            aria-current={activeView === item.id ? 'page' : undefined}
            title={item.label}
          >
            <Icon size={18} strokeWidth={1.5} />
          </button>
        )
      })}
    </nav>
  )
}
