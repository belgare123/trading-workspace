// ── NodeRegistry — Bridges domain registries to visual node definitions ──
//
// Maps definitionId → NodeDefinition for the visual builder.
// Auto-populated from SignalRegistry / ConditionRegistry / ActionRegistry.
//
// Marketplace benefit: registering a new domain definition automatically
// makes it available in the builder palette — no UI code needed.
//
// @since 3.6.2

import type { NodeDefinition } from './types'

export class NodeRegistry {
  private static _instance: NodeRegistry
  private readonly _definitions = new Map<string, NodeDefinition>()

  static getInstance(): NodeRegistry {
    if (!NodeRegistry._instance) {
      NodeRegistry._instance = new NodeRegistry()
    }
    return NodeRegistry._instance
  }

  register(def: NodeDefinition): void {
    if (this._definitions.has(def.id)) {
      // Allow re-registration (hot reload in dev)
      return
    }
    this._definitions.set(def.id, def)
  }

  get(id: string): NodeDefinition | undefined {
    return this._definitions.get(id)
  }

  has(id: string): boolean {
    return this._definitions.has(id)
  }

  getAll(): NodeDefinition[] {
    return Array.from(this._definitions.values())
  }

  getByCategory(category: string): NodeDefinition[] {
    return this.getAll().filter(def => def.category === category)
  }

  getPalette(): { category: string; items: NodeDefinition[] }[] {
    const groups = new Map<string, NodeDefinition[]>()
    for (const def of this._definitions.values()) {
      const cat = def.category
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(def)
    }
    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }))
  }

  clear(): void {
    this._definitions.clear()
  }
}
