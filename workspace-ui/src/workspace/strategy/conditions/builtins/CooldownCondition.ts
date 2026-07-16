// ── CooldownCondition — prevents re-firing for N bars ──
//
// Temporal cooldown: once this condition is satisfied, it blocks
// re-firing for the specified number of bars.
//
// Parameters:
//   bars - number of bars to wait before allowing re-fire
//
// State:
//   lastFiredAtBar - bar index when last satisfied
//   barsSinceFired - how many bars since last fire
//
// @since 3.4.4

import type { ConditionDefinition, ConditionEvaluationOutput } from '../definition/ConditionDefinition'
import type { ConditionInput } from '../types'

export const CooldownCondition: ConditionDefinition = {
  id: 'cooldown',
  name: 'Cooldown',
  description: 'Prevents re-firing for N bars after satisfaction',
  version: '1.0.0',
  parameters: [
    { id: 'bars', name: 'Cooldown Bars', type: 'number', default: 10, description: 'Bars to wait before re-firing', min: 1, max: 1000 },
  ],

  async evaluate(input: ConditionInput): Promise<ConditionEvaluationOutput> {
    const { childResults, nodeState, params } = input

    const cooldownBars = (params.bars as number) ?? 10
    const barsSinceFire = (nodeState.barsSinceFire as number) ?? cooldownBars + 1
    const child = childResults[0]

    const inCooldown = barsSinceFire <= cooldownBars
    const childSatisfied = child?.satisfied ?? false

    // Can fire?
    if (childSatisfied && !inCooldown) {
      return {
        result: {
          satisfied: true,
          score: 1,
          reason: `Fired after ${barsSinceFire} bars cooldown`,
          matchedSignals: child?.matchedSignals,
        },
        nextState: { barsSinceFire: 1 },
      }
    }

    // In cooldown
    if (inCooldown) {
      const remaining = cooldownBars - barsSinceFire + 1
      return {
        result: {
          satisfied: false,
          score: 0,
          reason: `In cooldown: ${barsSinceFire}/${cooldownBars} bars (${remaining} remaining)`,
        },
        nextState: { barsSinceFire: barsSinceFire + 1 },
      }
    }

    // Child not satisfied, out of cooldown — nothing to block
    return {
      result: {
        satisfied: false,
        score: 0,
        reason: 'Child not satisfied, out of cooldown',
      },
      nextState: { barsSinceFire: barsSinceFire + 1 },
    }
  },
}
