import { ScreenRegistry } from '../runtime/dashboard/screen/ScreenRegistry'
import { useStore } from '../store'
import { Telemetry } from '../telemetry'
import { useMemo } from 'react'

/**
 * Nav — sidebar navigation.
 *
 * Reads ALL registered screens from ScreenRegistry.
 * No hardcoded items. Register a screen → it appears here.
 */
export function Nav() {
  const activeView = useStore((s) => s.activeView)
  const setActiveView = useStore((s) => s.setActiveView)

  const items = useMemo(() => ScreenRegistry.all(), [])

  return (
    <nav className="sidebar" role="navigation" aria-label="Main navigation">
      {items.map((item: { id: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; title: string }) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            onClick={() => {
              Telemetry.viewChanged(item.id)
              setActiveView(item.id)
            }}
            className={`sidebar-btn${activeView === item.id ? ' active' : ''}`}
            aria-label={item.title}
            aria-current={activeView === item.id ? 'page' : undefined}
            title={item.title}
          >
            <Icon size={18} strokeWidth={1.5} />
          </button>
        )
      })}
    </nav>
  )
}
