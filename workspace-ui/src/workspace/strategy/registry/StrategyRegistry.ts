// ── StrategyRegistry — singleton registry of strategy definitions ──
// Analogous to OverlayRegistry in Chart Studio.
// StrategyRuntime never knows concrete strategy types —
// it only queries this registry.
//
// @since 3.4.1

import type { StrategyDefinition } from '../definition'

class StrategyRegistryImpl {
  private readonly _defs = new Map<string, StrategyDefinition>()

  /** Register a strategy definition. Overwrites any existing definition with the same id. */
  register(def: StrategyDefinition): void {
    this._defs.set(def.id, def)
  }

  /** Unregister a strategy definition by id. */
  unregister(id: string): void {
    this._defs.delete(id)
  }

  /** Get a definition by id. Returns undefined if not registered. */
  get(id: string): StrategyDefinition | undefined {
    return this._defs.get(id)
  }

  /** Get all registered definitions, ordered by registration order. */
  list(): readonly StrategyDefinition[] {
    return [...this._defs.values()]
  }

  /** Check if a definition is registered. */
  has(id: string): boolean {
    return this._defs.has(id)
  }

  /** Number of registered definitions. */
  get count(): number {
    return this._defs.size
  }
}

/** Singleton instance */
export const StrategyRegistry = new StrategyRegistryImpl()
