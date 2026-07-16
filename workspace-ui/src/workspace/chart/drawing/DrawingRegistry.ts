// ── DrawingRegistry — singleton registry of drawing definitions ──
// Analogous to IndicatorRegistry.
// Chart never knows concrete drawing types — it only queries this registry.

import type { DrawingDefinition } from './DrawingDefinition'

class DrawingRegistryImpl {
  private readonly _defs = new Map<string, DrawingDefinition>()

  /** Register a drawing definition. Overwrites any existing definition with the same id. */
  register(def: DrawingDefinition): void {
    this._defs.set(def.id, def)
  }

  /** Get a definition by id. Returns undefined if not registered. */
  get(id: string): DrawingDefinition | undefined {
    return this._defs.get(id)
  }

  /** Get all registered definitions, ordered by registration order. */
  list(): readonly DrawingDefinition[] {
    return [...this._defs.values()]
  }

  /** Get definitions grouped by category. */
  categories(): { category: string; definitions: DrawingDefinition[] }[] {
    const groups = new Map<string, DrawingDefinition[]>()
    for (const def of this._defs.values()) {
      const list = groups.get(def.category)
      if (list) list.push(def)
      else groups.set(def.category, [def])
    }
    return [...groups.entries()].map(([category, definitions]) => ({
      category,
      definitions,
    }))
  }
}

/** Singleton instance */
export const DrawingRegistry = new DrawingRegistryImpl()
