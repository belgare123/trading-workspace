import { type ReactNode } from 'react'
import { Toolbar } from './Toolbar'
import { KpiStrip } from './KpiStrip'
import { Nav } from './Nav'
import { Panel } from './Panel'
import { StatusBar } from './StatusBar'
import { useStore } from '../store'
import { TimelineDock, Inspector } from '../timeline'
import { NotificationProvider } from '../components/Notifications'

interface AppLayoutProps {
  children: ReactNode
  panelContent?: ReactNode
}

export function AppLayout({ children, panelContent }: AppLayoutProps) {
  const rightPanelOpen = useStore((s) => s.rightPanelOpen)
  const timelineOpen = useStore((s) => s.timelineOpen)

  return (
    <NotificationProvider>
      <div className="app-shell" style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Skip link for keyboard users */}
      <a href="#workspace-main" className="skip-link" style={{ position: 'absolute', left: -9999, top: 0, zIndex: 9999, padding: '4px 8px', background: 'var(--primary)', color: '#fff', fontSize: 12 }}>
        Skip to main content
      </a>

      {/* Top Bar */}
      <Toolbar />

      {/* KPI Strip */}
      <KpiStrip />

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Navigation */}
        <Nav />

        {/* Workspace */}
        <main
          id="workspace-main"
          style={{ flex: 1, overflow: 'auto' }}
          aria-label="Workspace content"
          tabIndex={-1}
        >
          {children}
        </main>

        {/* Inspector */}
        <Inspector isOpen={true} />

        {/* Right Panel */}
        {rightPanelOpen && <Panel>{panelContent}</Panel>}
      </div>

      {/* Timeline Dock */}
      <TimelineDock isOpen={timelineOpen} />

      {/* Status Bar */}
      <StatusBar />
    </div>
    </NotificationProvider>
  )
}
