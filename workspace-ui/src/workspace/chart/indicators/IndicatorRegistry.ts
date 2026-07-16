/**
 * IndicatorRegistry.ts — singleton registry of indicator definitions
 *
 * Follows the same pattern as Dashboard/WidgetRegistry:
 *   - register(def) at bootstrap
 *   - get(id) for lookup
 *   - list() for enumeration
 *
 * The registry holds *definitions*, not instances. Active instances
 * are managed per-chart by IndicatorRuntime.
 *
 * @since 3.3.3
 */

import type { IndicatorDefinition } from './IndicatorDefinition'

class IndicatorRegistryClass {
  private _definitions = new Map<string, IndicatorDefinition>()

  /** Register an indicator definition */
  register(def: IndicatorDefinition): void {
    if (this._definitions.has(def.id)) {
      if (import.meta.env.DEV) {
        console.warn(`[IndicatorRegistry] Overwriting indicator '${def.id}'`)
      }
    }
    this._definitions.set(def.id, def)
  }

  /** Look up an indicator by id */
  get(id: string): IndicatorDefinition | undefined {
    return this._definitions.get(id)
  }

  /** List all registered indicators */
  list(): IndicatorDefinition[] {
    return Array.from(this._definitions.values())
  }

  /** Number of registered indicators */
  get size(): number {
    return this._definitions.size
  }
}

/** Singleton instance */
export const IndicatorRegistry = new IndicatorRegistryClass()
