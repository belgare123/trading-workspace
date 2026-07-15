/**
 * BenchmarkRegistry — register and query benchmark scenarios
 *
 * @since 2.0.0
 */

import type { BenchmarkScenario, BenchmarkCategory } from './types'

export class BenchmarkRegistry {
  private static scenarios = new Map<string, BenchmarkScenario>()

  /** Register a new benchmark scenario */
  static register(scenario: BenchmarkScenario): void {
    if (this.scenarios.has(scenario.id)) {
      console.warn(`[BenchmarkRegistry] Overwriting scenario: ${scenario.id}`)
    }
    this.scenarios.set(scenario.id, scenario)
  }

  /** Get a scenario by ID */
  static get(id: string): BenchmarkScenario | undefined {
    return this.scenarios.get(id)
  }

  /** Get all scenarios, optionally filtered by category */
  static list(category?: BenchmarkCategory): BenchmarkScenario[] {
    const all = Array.from(this.scenarios.values())
    if (!category) return all
    return all.filter((s) => s.category === category)
  }

  /** Get all categories that have registered scenarios */
  static categories(): BenchmarkCategory[] {
    const cats = new Set<BenchmarkCategory>()
    for (const s of this.scenarios.values()) {
      cats.add(s.category)
    }
    return Array.from(cats)
  }

  /** Unregister a scenario */
  static unregister(id: string): void {
    this.scenarios.delete(id)
  }

  /** Clear all registered scenarios */
  static reset(): void {
    this.scenarios.clear()
  }
}
