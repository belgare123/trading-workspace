// ── XorCondition — exactly one child must be satisfied ──
//
// Logical XOR: returns satisfied=true when EXACTLY ONE child is satisfied.
// Score is the single satisfied child's score, or 0.
//
// @since 3.4.4

import type { ConditionDefinition } from '../definition/ConditionDefinition'
import type { ConditionInput, ConditionEvaluationOutput } from '../definition/ConditionDefinition'

export const XorCondition: ConditionDefinition = {
  id: 'xor',
  name: 'XOR',
  description: 'Exactly one child condition must be satisfied',
  version: '1.0.0',

  async evaluate(input: ConditionInput): Promise<ConditionEvaluationOutput> {
    const { childResults } = input

    if (childResults.length === 0) {
      return { result: { satisfied: false, reason: 'No child conditions' }, nextState: {} }
    }

    const satisfied = childResults.filter((r: { satisfied: boolean }) => r.satisfied)

    if (satisfied.length === 1) {
      const only = satisfied[0]
      return {
        result: {
          satisfied: true,
          score: only.score ?? 1,
          reason: `XOR satisfied by: ${only.reason ?? 'unknown'}`,
          matchedSignals: only.matchedSignals,
        },
        nextState: {},
      }
    }

    return {
      result: {
        satisfied: false,
        score: 0,
        reason: satisfied.length === 0
          ? 'XOR failed: no conditions satisfied'
          : `XOR failed: ${satisfied.length} conditions satisfied (need exactly 1)`,
      },
      nextState: {},
    }
  },
}
