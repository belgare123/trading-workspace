/**
 * ScenarioRegistry.ts — Central registry of all certification scenarios
 *
 * Scenarios register themselves by category. The registry supports
 * filtering by category, severity, tags, and individual IDs.
 *
 * @since 4.9
 */

import type { ScenarioDefinition, ScenarioCategory, ScenarioFilter, ScenarioId } from './ScenarioDefinition'

export class ScenarioRegistry {
  private scenarios = new Map<ScenarioId, ScenarioDefinition>()
  private byCategory = new Map<ScenarioCategory, ScenarioDefinition[]>()

  /** Register a scenario */
  register(scenario: ScenarioDefinition): void {
    if (this.scenarios.has(scenario.id)) {
      throw new Error(`ScenarioRegistry: duplicate scenario id '${scenario.id}'`)
    }
    this.scenarios.set(scenario.id, scenario)

    const catList = this.byCategory.get(scenario.category) ?? []
    catList.push(scenario)
    this.byCategory.set(scenario.category, catList)
  }

  /** Register multiple scenarios at once */
  registerAll(...scenarios: ScenarioDefinition[]): void {
    for (const s of scenarios) {
      this.register(s)
    }
  }

  /** Get a single scenario by ID */
  get(id: ScenarioId): ScenarioDefinition | undefined {
    return this.scenarios.get(id)
  }

  /** List all registered scenarios */
  all(): ScenarioDefinition[] {
    return Array.from(this.scenarios.values())
  }

  /** Get scenarios by category */
  byCategoryName(category: ScenarioCategory): ScenarioDefinition[] {
    return this.byCategory.get(category) ?? []
  }

  /** Count by category */
  countByCategory(): Record<ScenarioCategory, number> {
    const counts: Record<string, number> = {}
    for (const [, def] of this.scenarios) {
      counts[def.category] = (counts[def.category] ?? 0) + 1
    }
    return counts as Record<ScenarioCategory, number>
  }

  /** Total count */
  get totalCount(): number {
    return this.scenarios.size
  }

  /** Filter scenarios by criteria */
  filter(filter?: ScenarioFilter): ScenarioDefinition[] {
    if (!filter) return this.all()

    return this.all().filter((s) => {
      if (filter.categories && !filter.categories.includes(s.category)) return false
      if (filter.severity && !filter.severity.includes(s.severity)) return false
      if (filter.tags && !filter.tags.some((t) => s.tags?.includes(t))) return false
      if (filter.ids && !filter.ids.includes(s.id)) return false
      return true
    })
  }

  /** Clear all registered scenarios */
  clear(): void {
    this.scenarios.clear()
    this.byCategory.clear()
  }

  /**
   * Check whether a set of category counts matches expected.
   * Useful for ensuring all builtins are registered during bootstrap.
   */
  verifyCounts(expected: Partial<Record<ScenarioCategory, number>>): string[] {
    const errors: string[] = []
    const actual = this.countByCategory()
    for (const [cat, expectedCount] of Object.entries(expected)) {
      const actualCount = actual[cat as ScenarioCategory] ?? 0
      if (actualCount !== expectedCount) {
        errors.push(
          `Category '${cat}': expected ${expectedCount} scenarios, got ${actualCount}`,
        )
      }
    }
    return errors
  }
}
