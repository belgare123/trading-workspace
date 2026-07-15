/**
 * DashboardPreset types
 *
 * Core contracts for the Dashboard Runtime.
 * Dashboard knows NOTHING about widgets — only presets and screens.
 *
 * @since 3.0.0
 */

/** Supported screen layout modes */
export type ScreenLayout = '3-column' | '2-column' | 'single'

/**
 * A screen is a logical view within a dashboard preset.
 * It describes WHAT widgets to show and HOW to arrange them —
 * but never imports or references widget components directly.
 */
export interface DashboardScreen {
  /** Unique screen id (e.g. 'overview', 'markets', 'signals') */
  id: string
  /** Human-readable label */
  title: string
  /** Layout strategy for widget positioning */
  layout: ScreenLayout
  /** Ordered list of widget definition IDs (registered in WidgetRegistry) */
  widgets: string[]
}

/**
 * DashboardPreset — the ONLY thing DashboardShell knows about.
 *
 * A preset is a named collection of screens.
 * Widgets are referenced by string ID only.
 */
export interface DashboardPreset {
  /** Unique preset id (e.g. 'executive-overview') */
  id: string
  /** Human-readable title */
  title: string
  /** Optional description */
  description?: string
  /** Ordered screens */
  screens: DashboardScreen[]
}

/** Preset registry entry (runtime wrapper) */
export interface PresetEntry {
  preset: DashboardPreset
  created: number
}
