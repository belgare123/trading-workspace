// ── OrCondition — at least one child must be satisfied ──
//
// Logical OR: returns satisfied=true if ANY child is satisfied.
// Score is the max child score.
// Matched signals from the best satisfied child are propagated.
//
// @since 3.4.4

import type { ConditionDefinition, ConditionEvaluationOutput } from '../definition/ConditionDefinition'
import type { ConditionInput } from '../types'
import type { ConditionResult } from '../types'
import { collectMatchedSignals } from '../utils/ConditionHelpers'

export const OrCondition: ConditionDefinition = {
  id: 'or',
  name: 'OR',
  description: 'At least one child condition must be satisfied',
  version: '1.0.0',

  async evaluate(input: ConditionInput): Promise<ConditionEvaluationOutput> {
    const { childResults } = input

    if (childResults.length === 0) {
      return { result: { satisfied: false, reason: 'No child conditions' }, nextState: {} }
    }

    const satisfied = childResults.filter((r: ConditionResult) => r.satisfied)

    if (satisfied.length > 0) {
      // Find the best scoring satisfied child
      let best = satisfied[0]
      for (let i = 1; i < satisfied.length; i++) {
        if ((satisfied[i].score ?? 0) > (best.score ?? 0)) {
          best = satisfied[i]
        }
      }
      return {
        result: {
          satisfied: true,
          score: best.score ?? 1,
          reason: `Satisfied by: ${best.reason ?? satisfied[0].reason ?? 'unknown'}`,
          matchedSignals: best.matchedSignals ?? collectMatchedSignals(satisfied),
        },
        nextState: {},
      }
    }

    return {
      result: {
        satisfied: false,
        score: 0,
        reason: `No conditions satisfied (${childResults.length} children)`,
      },
      nextState: {},
    }
  },
}
