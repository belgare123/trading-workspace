import { Registry } from './Registry'
import type { WidgetCategory, WidgetDefinition } from './types'

type CategoryGroup = {
  category: WidgetCategory
  label: string
  widgets: WidgetDefinition[]
}

/**
 * WidgetRegistry — registry of widget definitions.
 *
 * Extends Registry<WidgetDefinition> with category grouping and metadata helpers.
 */
class WidgetRegistryClass extends Registry<WidgetDefinition> {
  /** Get widgets grouped by category */
  categories(): CategoryGroup[] {
    const groups = new Map<WidgetCategory, WidgetDefinition[]>()
    for (const w of this.items.values()) {
      if (!groups.has(w.category)) groups.set(w.category, [])
      groups.get(w.category)!.push(w)
    }
    const labels: Record<WidgetCategory, string> = {
      analysis: 'Analysis',
      trading: 'Trading',
      monitoring: 'Monitoring',
      ml: 'Machine Learning',
      system: 'System',
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, widgets]) => ({ category, label: labels[category] ?? category, widgets }))
  }

  /** Get all unique categories */
  getCategories(): WidgetCategory[] {
    const categories = new Set<WidgetCategory>()
    for (const w of this.items.values()) {
      categories.add(w.category)
    }
    return Array.from(categories)
  }

  /** Create metadata summary */
  metadata(): { total: number; categories: number; ids: string[] } {
    return {
      total: this.items.size,
      categories: this.getCategories().length,
      ids: Array.from(this.items.keys()),
    }
  }
}

/** Global singleton */
export const WidgetRegistry = new WidgetRegistryClass();
