import type { ReactNode } from 'react';

export interface AppShellProps {
  topbar?: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
  kpiStrip?: ReactNode;
  inspector?: ReactNode;
  statusBar?: ReactNode;
}

/**
 * AppShell — Trading Terminal layout.
 *   Topbar | KPI Strip | Sidebar + Main + Inspector | StatusBar
 */
export function AppShell({ topbar, sidebar, children, kpiStrip, inspector, statusBar }: AppShellProps) {
  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Bar */}
      {topbar}

      {/* KPI Strip */}
      {kpiStrip}

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        {sidebar}

        {/* Main content */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>

        {/* Inspector */}
        {inspector && (
          <aside style={{ width: 300, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', overflow: 'auto' }}>
            {inspector}
          </aside>
        )}
      </div>

      {/* Status Bar */}
      {statusBar}
    </div>
  );
}
