import { type ReactNode } from 'react'
import { Toolbar } from './Toolbar'
import { Nav } from './Nav'
import { Panel } from './Panel'
import { StatusBar } from './StatusBar'
import { useStore } from '../store'
import { TimelineDock, Inspector } from '../timeline'

interface AppLayoutProps {
  children: ReactNode
  panelContent?: ReactNode
}

export function AppLayout({ children, panelContent }: AppLayoutProps) {
  const rightPanelOpen = useStore((s) => s.rightPanelOpen)
  const timelineOpen = useStore((s) => s.timelineOpen)

  return (
    <div className="h-full flex flex-col bg-surface-100">
      {/* Skip link for keyboard users */}
      <a href="#workspace-main" className="skip-link">
        Skip to main content
      </a>

      {/* Toolbar */}
      <Toolbar />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation */}
        <Nav />

        {/* Workspace */}
        <main
          id="workspace-main"
          className="flex-1 overflow-y-auto bg-surface-100 p-4"
          aria-label="Workspace content"
          tabIndex={-1}
        >
          {children}
        </main>

        {/* Inspector — right panel (opens when an event is selected) */}
        <Inspector isOpen={true} />

        {/* Right Panel */}
        {rightPanelOpen && <Panel>{panelContent}</Panel>}
      </div>

      {/* Timeline Dock — bottom */}
      <TimelineDock isOpen={timelineOpen} />

      {/* Status Bar */}
      <StatusBar />
    </div>
  )
}
