// ── AndCondition — all children must be satisfied ──
//
// Logical AND: returns satisfied=true only if ALL children are satisfied.
// Score is the average of child scores.
//
// @since 3.4.4

import type { ConditionDefinition } from '../definition/ConditionDefinition'
import type { ConditionInput, ConditionEvaluationOutput } from '../definition/ConditionDefinition'
import { aggregateScore, collectMatchedSignals, collectReasons } from '../utils/ConditionHelpers'

export const AndCondition: ConditionDefinition = {
  id: 'and',
  name: 'AND',
  description: 'All child conditions must be satisfied',
  version: '1.0.0',

  async evaluate(input: ConditionInput): Promise<ConditionEvaluationOutput> {
    const { childResults } = input

    if (childResults.length === 0) {
      return { result: { satisfied: false, reason: 'No child conditions' }, nextState: {} }
    }

    const allSatisfied = childResults.every((r: { satisfied: boolean }) => r.satisfied)
    const score = allSatisfied ? aggregateScore(childResults) : 0
    const reasons = allSatisfied
      ? collectReasons(childResults)
      : childResults.filter((r: { satisfied: boolean }) => !r.satisfied).map((r: { reason?: string }) => r.reason ?? 'unsatisfied')

    return {
      result: {
        satisfied: allSatisfied,
        score,
        reason: allSatisfied
          ? `All ${childResults.length} conditions satisfied`
          : `Not all satisfied: ${reasons.join(', ')}`,
        matchedSignals: collectMatchedSignals(childResults),
      },
      nextState: {},
    }
  },
}
