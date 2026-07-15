import { useEffect, useState } from 'react'
import { LayoutSwitcher } from '../components/LayoutSwitcher'
import { DashboardPresetSwitcher } from '../components/DashboardPresetSwitcher'
import { useStore } from '../store'

export function Toolbar() {
  const [time, setTime] = useState('')
  const runtime = useStore((s) => s.systemMetrics?.runtime ?? 98)
  const wsClients = useStore((s) => s.systemMetrics?.ws_clients ?? 26)
  const health = useStore((s) => s.health?.overall_score ?? 87)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const healthColor = health >= 80 ? 'var(--success)' : health >= 50 ? 'var(--warning)' : 'var(--danger)'

  return (
    <header className="topbar" role="toolbar" aria-label="Workspace toolbar">
      {/* Brand */}
      <div className="topbar-brand">
        <span>⚡</span>
        <span>Workspace</span>
      </div>

      <DashboardPresetSwitcher />

      <div className="topbar-spacer" />

      {/* Right side — indicators (Spec §1.7 Topbar) */}
      <div className="topbar-indicator">
        <span className="dot" style={{ backgroundColor: 'var(--success)' }} />
        <span className="val">{runtime}%</span>
        <span>Runtime</span>
      </div>

      <div className="topbar-indicator">
        <span className="dot" style={{ backgroundColor: 'var(--primary)' }} />
        <span className="val">{wsClients}</span>
        <span>WS</span>
      </div>

      <div className="topbar-indicator">
        <span className="dot" style={{ backgroundColor: healthColor }} />
        <span className="val">{health}</span>
        <span>Health</span>
      </div>

      <div className="topbar-indicator">
        <LayoutSwitcher />
      </div>

      <div className="topbar-indicator" style={{ fontFamily: 'var(--font-mono)', fontWeight: 400 }}>
        {time}
      </div>
    </header>
  )
}
