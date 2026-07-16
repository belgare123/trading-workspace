// ── MetricRegistry — Registration and lookup of MetricDefinitions ──
//
// @since 3.5.2

import type { MetricDefinition, MetricCategory } from '../types'

export class MetricRegistry {
  private definitions: Map<string, MetricDefinition> = new Map()

  /** Register a metric definition */
  register(definition: MetricDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Metric '${definition.id}' is already registered`)
    }
    this.definitions.set(definition.id, definition)
  }

  /** Register multiple definitions at once */
  registerAll(definitions: MetricDefinition[]): void {
    for (const def of definitions) {
      this.register(def)
    }
  }

  /** Get a metric by id */
  get(id: string): MetricDefinition | undefined {
    return this.definitions.get(id)
  }

  /** List all registered metrics */
  all(): MetricDefinition[] {
    return Array.from(this.definitions.values())
  }

  /** Filter metrics by category */
  byCategory(category: MetricCategory): MetricDefinition[] {
    return this.all().filter(m => m.category === category)
  }

  /** Number of registered metrics */
  get size(): number {
    return this.definitions.size
  }

  /** Check if a metric is registered */
  has(id: string): boolean {
    return this.definitions.has(id)
  }

  /** Clear all metrics */
  clear(): void {
    this.definitions.clear()
  }
}
