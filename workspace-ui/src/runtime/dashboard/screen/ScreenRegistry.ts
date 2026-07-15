import { Registry } from '../../Registry'
import type { LucideIcon } from 'lucide-react'

/**
 * ScreenEntry — registration model for the ScreenRegistry.
 *
 * Each screen is a first-class citizen in the Workspace:
 * - If `preset` is set, rendering goes through DashboardShell → PresetRegistry → WidgetRegistry
 * - If `preset` is omitted, a fallback page component is used (legacy bridge)
 *
 * This is the ONLY source of truth for navigation.
 * Sidebar, Palette, Search, and Layout Manager all read from here.
 */
export interface ScreenEntry {
  /** Unique screen ID (e.g. 'overview'). Used as activeView in store. */
  id: string
  /** Human-readable title (e.g. 'Executive Overview') */
  title: string
  /** Optional Dashboard Preset ID. When set, renders via DashboardShell. */
  preset?: string
  /** Lucide icon component */
  icon: LucideIcon
  /** Category for grouping in sidebar/palette */
  category: string
  /** Sort order (lower = first) */
  order: number
}

/**
 * ScreenRegistry — singleton registry for workspace screens.
 *
 * Chain:
 *   Sidebar → ScreenRegistry → PresetRegistry → WidgetRegistry → DataProviderRegistry
 */
class ScreenRegistryClass extends Registry<ScreenEntry> {
  /** All screens sorted by display order */
  all(): ScreenEntry[] {
    return Array.from(this.items.values()).sort((a, b) => a.order - b.order)
  }

  /** Screens filtered to a single category */
  byCategory(category: string): ScreenEntry[] {
    return this.all().filter(s => s.category === category)
  }
}

export const ScreenRegistry = new ScreenRegistryClass()
