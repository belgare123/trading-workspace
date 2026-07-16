// ── OverlayRegistry — singleton registry of overlay definitions ──
// Analogous to DrawingRegistry.
// Chart never knows concrete overlay types — it only queries this registry.
//
// @since 3.3.6

import type { OverlayDefinition } from './OverlayDefinition'

class OverlayRegistryImpl {
  private readonly _defs = new Map<string, OverlayDefinition>()

  /** Register an overlay definition. Overwrites any existing definition with the same id. */
  register(def: OverlayDefinition): void {
    this._defs.set(def.id, def)
  }

  /** Get a definition by id. Returns undefined if not registered. */
  get(id: string): OverlayDefinition | undefined {
    return this._defs.get(id)
  }

  /** Get all registered definitions, ordered by registration order. */
  list(): readonly OverlayDefinition[] {
    return [...this._defs.values()]
  }

  /** Get definitions grouped by category. */
  categories(): { category: string; definitions: OverlayDefinition[] }[] {
    const groups = new Map<string, OverlayDefinition[]>()
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
export const OverlayRegistry = new OverlayRegistryImpl()
