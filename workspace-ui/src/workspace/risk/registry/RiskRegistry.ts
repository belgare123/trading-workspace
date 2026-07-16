/**
 * RiskRegistry.ts — Central registry of risk rule definitions
 *
 * Mirrors platform pattern: Definition → Registry → Runtime.
 * Rules can be registered, retrieved, enabled/disabled at runtime.
 *
 * @since 4.7
 */

import type { RiskRuleDefinition } from '../definition/RiskDefinition'
import type { RiskRuleConfig } from '../types'

export class RiskRegistry {
  private rules: Map<string, RiskRuleDefinition> = new Map()
  private configs: Map<string, RiskRuleConfig> = new Map()

  /** Register a rule definition */
  register(definition: RiskRuleDefinition): void {
    if (this.rules.has(definition.id)) {
      throw new Error(`RiskRegistry: rule "${definition.id}" already registered`)
    }
    this.rules.set(definition.id, definition)
    this.configs.set(definition.id, { ...definition.defaultConfig })

    // Validate if the definition provides a validator
    if (definition.validateConfig) {
      const error = definition.validateConfig(definition.defaultConfig)
      if (error) {
        throw new Error(`RiskRegistry: rule "${definition.id}" config validation failed: ${error}`)
      }
    }
  }

  /** Register multiple rules at once */
  registerAll(definitions: RiskRuleDefinition[]): void {
    for (const def of definitions) {
      this.register(def)
    }
  }

  /** Get a rule definition by id */
  get(id: string): RiskRuleDefinition | undefined {
    return this.rules.get(id)
  }

  /** Get the active config for a rule */
  getConfig(id: string): RiskRuleConfig | undefined {
    return this.configs.get(id)
  }

  /** Update config for a rule at runtime */
  updateConfig(id: string, partial: Partial<RiskRuleConfig>): boolean {
    const existing = this.configs.get(id)
    if (!existing) return false
    const updated = { ...existing, ...partial }

    // Re-validate
    const definition = this.rules.get(id)
    if (definition?.validateConfig) {
      const error = definition.validateConfig(updated)
      if (error) {
        throw new Error(`RiskRegistry: config update for "${id}" rejected: ${error}`)
      }
    }

    this.configs.set(id, updated)
    return true
  }

  /** Enable or disable a rule at runtime */
  setEnabled(id: string, enabled: boolean): boolean {
    return this.updateConfig(id, { enabled })
  }

  /** Check if a rule is registered and enabled */
  isEnabled(id: string): boolean {
    return this.configs.get(id)?.enabled ?? false
  }

  /** Get all registered rule definitions */
  getAll(): RiskRuleDefinition[] {
    return Array.from(this.rules.values())
  }

  /** Get all active (enabled) rule definitions with their configs */
  getActive(): { definition: RiskRuleDefinition; config: RiskRuleConfig }[] {
    const result: { definition: RiskRuleDefinition; config: RiskRuleConfig }[] = []
    for (const [id, definition] of this.rules) {
      const config = this.configs.get(id)
      if (config?.enabled) {
        result.push({ definition, config })
      }
    }
    return result
  }

  /** Remove a rule */
  unregister(id: string): boolean {
    this.configs.delete(id)
    return this.rules.delete(id)
  }

  /** Total registered rules */
  get size(): number {
    return this.rules.size
  }

  /** Reset all rules to their default configs */
  resetAll(): void {
    for (const [id, definition] of this.rules) {
      this.configs.set(id, { ...definition.defaultConfig })
    }
  }
}
