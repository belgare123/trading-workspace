// ── ObjectiveRegistry — Extendable registry of objective functions ──
//
// @since 3.5.4

import type { ObjectiveDefinition } from './ObjectiveDefinition'

export class ObjectiveRegistry {
  private _objectives: Map<string, ObjectiveDefinition> = new Map()

  /** Register a new objective function */
  register(objective: ObjectiveDefinition): void {
    if (this._objectives.has(objective.id)) {
      throw new Error(`Objective already registered: ${objective.id}`)
    }
    this._objectives.set(objective.id, objective)
  }

  /** Get an objective by id */
  get(id: string): ObjectiveDefinition | undefined {
    return this._objectives.get(id)
  }

  /** List all registered objectives */
  list(): ObjectiveDefinition[] {
    return Array.from(this._objectives.values())
  }

  /** Get objective ids by category */
  getBy(property: string, value: unknown): ObjectiveDefinition[] {
    return this.list().filter(o => (o as unknown as Record<string, unknown>)[property] === value)
  }

  /** Remove an objective */
  unregister(id: string): boolean {
    return this._objectives.delete(id)
  }

  /** Register multiple objectives */
  registerAll(...objectives: ObjectiveDefinition[]): void {
    for (const obj of objectives) {
      this.register(obj)
    }
  }

  get size(): number {
    return this._objectives.size
  }
}
