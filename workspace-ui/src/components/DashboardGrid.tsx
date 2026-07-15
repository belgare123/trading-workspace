/* ═══════════════════════════════════════════════════════════════
   DashboardGrid — 12-column responsive grid
   Spec: Workspace_UI_Architecture_v2.md §1.5
   ═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react'

interface DashboardGridProps {
  children: ReactNode
  className?: string
}

export function DashboardGrid({ children, className = '' }: DashboardGridProps) {
  return (
    <div className={`dashboard-grid ${className}`}>
      {children}
    </div>
  )
}
