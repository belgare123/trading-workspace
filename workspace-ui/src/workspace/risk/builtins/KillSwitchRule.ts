/**
 * KillSwitchRule.ts — Emergency stop trading for a strategy
 *
 * Provides a rule-level kill switch that can be triggered manually
 * or automatically by other risk rules. When active, all orders
 * from the strategy are rejected.
 *
 * @since 4.7
 */

import { createRiskDefinition } from '../definition/RiskDefinition'
import { reject } from '../utils/RiskHelpers'
import type { RiskContext, RiskDecision, RiskRuleConfig } from '../types'

interface KillSwitchParams {
  autoTriggerRules: string[]  // Rule IDs that can auto-trigger
}

// Per-strategy kill switch state
const killSwitches = new Map<string, { active: boolean; reason: string; triggeredAt: number; triggeredBy: string }>()

export function isKillSwitchActive(strategyId: string): boolean {
  return killSwitches.get(strategyId)?.active ?? false
}

export function activateStrategyKillSwitch(strategyId: string, reason: string, triggeredBy = 'manual'): void {
  killSwitches.set(strategyId, { active: true, reason, triggeredAt: Date.now(), triggeredBy })
}

export function deactivateStrategyKillSwitch(strategyId: string): void {
  killSwitches.set(strategyId, { active: false, reason: '', triggeredAt: 0, triggeredBy: '' })
}

export const KillSwitchRule = createRiskDefinition({
  id: 'kill_switch',
  name: 'Kill Switch',
  description: 'Emergency stop — blocks all orders from a strategy when active',
  defaultConfig: {
    severity: 'error',
    params: {
      autoTriggerRules: [],
    } satisfies KillSwitchParams,
  },
  evaluate(context: RiskContext, _config: RiskRuleConfig): RiskDecision {
    const strategyId = context.meta.strategyId
    const ks = killSwitches.get(strategyId)

    if (ks?.active) {
      return reject('kill_switch', 'Kill Switch',
        `Trading halted: ${ks.reason} (triggered by: ${ks.triggeredBy})`)
    }

    return { status: 'allow', violations: [], warnings: [], score: 1.0 }
  },
})
