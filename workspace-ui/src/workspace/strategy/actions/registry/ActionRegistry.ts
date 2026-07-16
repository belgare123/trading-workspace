// ── ActionRegistry — singleton registry for action definitions ──
//
// Pattern: ActionDefinition → ActionRegistry
// Same pattern as SignalRegistry, ConditionRegistry, OverlayRegistry.
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'

export class ActionRegistry {
  private static _instance: ActionRegistry
  private readonly _definitions = new Map<string, ActionDefinition>()

  static getInstance(): ActionRegistry {
    if (!ActionRegistry._instance) {
      ActionRegistry._instance = new ActionRegistry()
    }
    return ActionRegistry._instance
  }

  /** Register an action definition */
  register(def: ActionDefinition): void {
    if (this._definitions.has(def.id)) {
      throw new Error(`Action already registered: ${def.id}`)
    }
    this._definitions.set(def.id, def)
  }

  /** Get an action definition by id */
  get(id: string): ActionDefinition | undefined {
    return this._definitions.get(id)
  }

  /** Check if an action is registered */
  has(id: string): boolean {
    return this._definitions.has(id)
  }

  /** Get all registered action ids */
  get ids(): readonly string[] {
    return [...this._definitions.keys()]
  }

  /** Get all registered action definitions */
  getAll(): readonly ActionDefinition[] {
    return [...this._definitions.values()]
  }

  /** Number of registered actions */
  get count(): number {
    return this._definitions.size
  }

  /** Clear all registered actions */
  clear(): void {
    this._definitions.clear()
  }
}
