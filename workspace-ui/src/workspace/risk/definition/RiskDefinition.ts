/**
 * RiskDefinition.ts — Definition of a single risk rule
 *
 * A RiskDefinition declares WHAT a rule checks and HOW it behaves.
 * The actual evaluation logic lives in the rule implementation.
 * This mirrors the Definition pattern used by Signal, Condition, and Action.
 *
 * @since 4.7
 */

import type { RiskDecision, RiskContext, RiskRuleConfig } from '../types'

export interface RiskRuleDefinition {
  /** Unique rule identifier */
  id: string
  /** Human-readable name */
  name: string
  /** What this rule does */
  description: string
  /** Default configuration */
  defaultConfig: RiskRuleConfig

  /** Evaluate the rule against the given context */
  evaluate(context: RiskContext, config: RiskRuleConfig): RiskDecision | Promise<RiskDecision>

  /** Validate configuration (called on registration) */
  validateConfig?(config: RiskRuleConfig): string | null
}

// ── Helper to create rule definitions ──

export interface RiskDefinitionParams {
  id: string
  name: string
  description: string
  defaultConfig: Partial<RiskRuleConfig> & { params?: Record<string, unknown> }
  evaluate: (context: RiskContext, config: RiskRuleConfig) => RiskDecision | Promise<RiskDecision>
  validateConfig?: (config: RiskRuleConfig) => string | null
}

export function createRiskDefinition(params: RiskDefinitionParams): RiskRuleDefinition {
  const defaultConfig: RiskRuleConfig = {
    id: params.id,
    name: params.name,
    description: params.description,
    severity: 'error',
    enabled: true,
    params: {},
    ...params.defaultConfig,
  }

  return {
    id: params.id,
    name: params.name,
    description: params.description,
    defaultConfig,
    evaluate: params.evaluate,
    validateConfig: params.validateConfig,
  }
}
