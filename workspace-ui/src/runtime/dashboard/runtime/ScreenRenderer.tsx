'use client'

import { useMemo } from 'react'
import { WidgetRegistry } from '../../WidgetRegistry'
import { useRuntime } from '../../RuntimeContext'
import { cn } from '../../../lib/utils'
import type { DashboardScreen, ScreenLayout } from '../presets/types'

/* ── Layout adapters ── */

const layoutGrid: Record<ScreenLayout, string> = {
  '3-column': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  '2-column': 'grid-cols-1 lg:grid-cols-2',
  single: 'grid-cols-1',
}

const widgetSpan: Record<ScreenLayout, string> = {
  '3-column': 'lg:col-span-1',
  '2-column': 'lg:col-span-1',
  single: 'col-span-1',
}

/* ── Props ── */

interface ScreenRendererProps {
  screen: DashboardScreen
}

/**
 * ScreenRenderer — renders a full DashboardScreen.
 *
 * 1. Resolves widget IDs via WidgetRegistry.
 * 2. Lays out widgets in a CSS grid per the screen's layout setting.
 * 3. Wraps each widget in a Panel and renders its component.
 *
 * Dashboard never imports widgets directly — it only knows string IDs.
 */
export function ScreenRenderer({ screen }: ScreenRendererProps) {
  const runtime = useRuntime()

  const widgets = useMemo(
    () =>
      screen.widgets
        .map(id => ({ id, def: WidgetRegistry.get(id) }))
        .filter((e): e is { id: string; def: NonNullable<ReturnType<typeof WidgetRegistry.get>> } => e.def != null),
    [screen.widgets],
  )

  if (widgets.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">
        No widgets registered for this screen. Check WidgetRegistry.
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 auto-rows-min', layoutGrid[screen.layout])}>
      {widgets.map(({ id, def }) => {
        const WidgetComponent = def.render
        return (
          <div
            key={id}
            className={cn(
              'rounded-xl border border-[var(--border-base)] bg-[rgba(11,14,20,0.6)] backdrop-blur-[12px] overflow-hidden',
              widgetSpan[screen.layout],
            )}
          >
            {/* Widget header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-base)]">
              <span className="text-xs font-medium text-[var(--text-secondary)] truncate">
                {def.title}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                {def.category}
              </span>
            </div>

            {/* Widget body */}
            <div className="p-3 overflow-auto min-h-[80px]">
              <WidgetComponent
                instanceId={`dashboard-${id}`}
                definition={def}
                size={def.defaultSize}
                settings={(def.defaultSettings ?? {}) as Record<string, unknown>}
                runtime={runtime}
                onSettingsChange={() => {}}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
