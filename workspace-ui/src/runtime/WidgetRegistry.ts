import type { WidgetDefinition, WidgetCategory } from './types';

type CategoryGroup = {
  category: WidgetCategory;
  label: string;
  widgets: WidgetDefinition[];
};

/**
 * WidgetRegistry — singleton registry for widget definitions.
 * Pattern: register → get → create → categories
 * Analogous to CommandRegistry.
 */
class WidgetRegistryClass {
  private _widgets = new Map<string, WidgetDefinition>();

  /** Register a widget definition */
  register(def: WidgetDefinition): void {
    if (this._widgets.has(def.id)) {
      console.warn(`[WidgetRegistry] Overwriting widget '${def.id}'`);
    }
    this._widgets.set(def.id, def);
  }

  /** Unregister a widget by id */
  unregister(id: string): boolean {
    return this._widgets.delete(id);
  }

  /** Get a single widget definition */
  get(id: string): WidgetDefinition | undefined {
    return this._widgets.get(id);
  }

  /** Get all registered widget definitions */
  getAll(): WidgetDefinition[] {
    return Array.from(this._widgets.values());
  }

  /** Get widgets grouped by category */
  categories(): CategoryGroup[] {
    const groups = new Map<WidgetCategory, WidgetDefinition[]>();
    for (const w of this._widgets.values()) {
      if (!groups.has(w.category)) groups.set(w.category, []);
      groups.get(w.category)!.push(w);
    }
    const labels: Record<WidgetCategory, string> = {
      analysis: 'Analysis',
      trading: 'Trading',
      monitoring: 'Monitoring',
      ml: 'Machine Learning',
      system: 'System',
    };
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, widgets]) => ({ category, label: labels[category] ?? category, widgets }));
  }

  /** Get all unique categories */
  getCategories(): WidgetCategory[] {
    const categories = new Set<WidgetCategory>();
    for (const w of this._widgets.values()) {
      categories.add(w.category);
    }
    return Array.from(categories);
  }

  /** Create metadata summary */
  metadata(): { total: number; categories: number; ids: string[] } {
    return {
      total: this._widgets.size,
      categories: this.getCategories().length,
      ids: Array.from(this._widgets.keys()),
    };
  }

  /** Check if a widget is registered */
  has(id: string): boolean {
    return this._widgets.has(id);
  }

  /** Clear all registrations (for testing) */
  clear(): void {
    this._widgets.clear();
  }
}

/** Global singleton */
export const WidgetRegistry = new WidgetRegistryClass();
