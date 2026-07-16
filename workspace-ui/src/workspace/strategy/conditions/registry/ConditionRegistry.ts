// ── ConditionRegistry — singleton registry for condition definitions ──
//
// Pattern: ConditionDefinition → ConditionRegistry
// Same pattern as SignalRegistry, OverlayRegistry, IndicatorRegistry.
//
// @since 3.4.4

import type { ConditionDefinition } from '../definition/ConditionDefinition'

export class ConditionRegistry {
  private static _instance: ConditionRegistry
  private readonly _definitions = new Map<string, ConditionDefinition>()

  static getInstance(): ConditionRegistry {
    if (!ConditionRegistry._instance) {
      ConditionRegistry._instance = new ConditionRegistry()
    }
    return ConditionRegistry._instance
  }

  /** Register a condition definition */
  register(def: ConditionDefinition): void {
    if (this._definitions.has(def.id)) {
      throw new Error(`Condition already registered: ${def.id}`)
    }
    this._definitions.set(def.id, def)
  }

  /** Get a condition definition by id */
  get(id: string): ConditionDefinition | undefined {
    return this._definitions.get(id)
  }

  /** Check if a condition is registered */
  has(id: string): boolean {
    return this._definitions.has(id)
  }

  /** Get all registered condition ids */
  get ids(): readonly string[] {
    return [...this._definitions.keys()]
  }

  /** Get all registered condition definitions */
  getAll(): readonly ConditionDefinition[] {
    return [...this._definitions.values()]
  }

  /** Number of registered conditions */
  get count(): number {
    return this._definitions.size
  }

  /** Clear all registered conditions */
  clear(): void {
    this._definitions.clear()
  }
}
