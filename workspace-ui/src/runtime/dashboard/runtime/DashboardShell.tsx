'use client'

import { useCallback, useState } from 'react'
import { useDashboard } from './useDashboard'
import { ScreenRenderer } from './ScreenRenderer'
import { cn } from '../../../lib/utils'

/* ── Props ── */

interface DashboardShellProps {
  /** Registered preset ID (e.g. 'executive-overview') */
  preset: string
}

/**
 * DashboardShell — entry point for the Dashboard Runtime.
 *
 * Behaviour:
 * - Resolves `preset` from PresetRegistry
 * - Renders a screen tab bar (only if >1 screen)
 * - Delegates active screen rendering to ScreenRenderer
 *
 * Dashboard knows NOTHING about widgets.
 * It only knows the preset contract: id → screens → widget IDs.
 */
export function DashboardShell({ preset }: DashboardShellProps) {
  const dashboard = useDashboard(preset)
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null)

  const handleNavigate = useCallback((screenId: string) => {
    setActiveScreenId(screenId)
  }, [])

  /* ── Not found ── */

  if (!dashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-muted)]">
        <div className="text-4xl">◈</div>
        <div className="text-sm font-medium">Preset &ldquo;{preset}&rdquo; not found</div>
        <div className="text-xs">Register it with PresetRegistry before mounting DashboardShell</div>
      </div>
    )
  }

  /* ── Resolve active screen ── */

  const screens = dashboard.screens
  const activeId = activeScreenId ?? screens[0]?.id
  const activeScreen = screens.find(s => s.id === activeId)

  /* ── Render ── */

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Screen navigation tabs */}
      {screens.length > 1 && (
        <nav className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border-base)] bg-[rgba(11,14,20,0.3)] shrink-0 overflow-x-auto">
          {screens.map(screen => (
            <button
              key={screen.id}
              onClick={() => handleNavigate(screen.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
                activeId === screen.id
                  ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]',
              )}
            >
              {screen.title}
            </button>
          ))}
        </nav>
      )}

      {/* Active screen */}
      <div className="flex-1 overflow-auto p-4">
        {activeScreen ? (
          <ScreenRenderer screen={activeScreen} />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
            Screen not found: {activeId}
          </div>
        )}
      </div>
    </div>
  )
}
