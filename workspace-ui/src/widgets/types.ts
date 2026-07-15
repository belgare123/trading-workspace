/* ═══════════════════════════════════════════════════════════════
   Widget SDK — Types, Lifecycle, Registry
   Spec: Workspace_UI_Architecture_v2.md §2.2–2.5
   ═══════════════════════════════════════════════════════════════ */

import type { ReactNode, JSX } from 'react'

/* ── Widget Size ── */

export const WidgetSize = {
  SMALL:  'SMALL',   // 2 cols
  MEDIUM: 'MEDIUM',  // 4 cols
  LARGE:  'LARGE',   // 6 cols
  XL:     'XL',      // 8 cols
  FULL:   'FULL',    // 12 cols
} as const

export type WidgetSize = (typeof WidgetSize)[keyof typeof WidgetSize]

/* ── Widget Category ── */

export type WidgetCategory =
  | 'analysis'
  | 'trading'
  | 'portfolio'
  | 'market'
  | 'system'
  | 'monitoring'
  | 'replay'
  | 'plugins'
  | 'ml'

/* ── Widget Lifecycle ── */
/* Spec §2.2: Created → Mounted → Ready → Running → Sleeping → Hidden → Destroyed */

export interface WidgetLifecycle {
  onMount(): void
  onReady(): void
  onResize(size: WidgetSize): void
  onFocus(): void
  onBlur(): void
  onSuspend(): void
  onResume(): void
  onDestroy(): void
}

/* ── Widget Contract ── */
/* Spec §2.3 — every widget must implement this interface */

export interface Widget {
  id: string
  title: string
  icon: ReactNode
  category: WidgetCategory
  defaultSize: WidgetSize
  render(props: Record<string, unknown>): JSX.Element
  // optional lifecycle hooks
  onMount?(): void
  onReady?(): void
  onResize?(size: WidgetSize): void
  onSuspend?(): void
  onResume?(): void
  onDestroy?(): void
}

/* ── Widget Size Metadata ── */

export const WIDGET_SIZE_COLUMNS: Record<WidgetSize, number> = {
  [WidgetSize.SMALL]:  2,
  [WidgetSize.MEDIUM]: 4,
  [WidgetSize.LARGE]:  6,
  [WidgetSize.XL]:     8,
  [WidgetSize.FULL]:   12,
}

/* ── Dashboard Preset ── */
/* Spec §1.9 */

export interface GridPosition {
  x: number
  y: number
}

export interface DashboardPresetWidget {
  widgetId: string
  size: WidgetSize
  position: GridPosition
}

export interface DashboardPreset {
  id: string
  title: string
  description: string
  widgets: DashboardPresetWidget[]
  permissions: string[]
}

/* ── Status Language ── */
/* Spec §3.2 — единый словарь статусов */

export type RuntimeStatus =
  | 'ready'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'loading'
  | 'failed'
  | 'warning'
  | 'offline'
  | 'unknown'

export const STATUS_COLORS: Record<RuntimeStatus, string> = {
  ready:   'var(--primary)',
  running: 'var(--success)',
  paused:  'var(--warning)',
  stopped: 'var(--danger)',
  loading: 'var(--text-muted)',
  failed:  'var(--danger)',
  warning: 'var(--warning)',
  offline: 'var(--text-muted)',
  unknown: 'var(--text-muted)',
}

/* ── Error Levels ── */
/* Spec §3.4 */

export type ErrorLevel = 'info' | 'warning' | 'recoverable' | 'critical' | 'fatal'

/* ── Empty State ── */
/* Spec §3.3 */

export interface EmptyState {
  icon: string
  title: string
  description: string
  actionLabel: string
  action?: () => void
  secondaryLabel?: string
  secondaryAction?: () => void
}
