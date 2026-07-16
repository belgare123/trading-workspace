// ── NotCondition — negates child condition ──
//
// Logical NOT: returns satisfied=true when the child is NOT satisfied.
// Score is inverted (1 - child score).
// No matched signals are propagated (negation doesn't confirm signals).
//
// @since 3.4.4

import type { ConditionDefinition } from '../definition/ConditionDefinition'
import type { ConditionInput, ConditionEvaluationOutput } from '../definition/ConditionDefinition'

export const NotCondition: ConditionDefinition = {
  id: 'not',
  name: 'NOT',
  description: 'Negates the child condition result',
  version: '1.0.0',

  async evaluate(input: ConditionInput): Promise<ConditionEvaluationOutput> {
    const { childResults } = input

    if (childResults.length === 0) {
      return { result: { satisfied: false, reason: 'No child condition' }, nextState: {} }
    }

    // Only evaluate first child
    const child = childResults[0]
    const satisfied = !child.satisfied
    const score = child.score != null ? 1 - child.score : (satisfied ? 1 : 0)

    return {
      result: {
        satisfied,
        score,
        reason: satisfied
          ? `NOT (${child.reason ?? 'condition'}) — inverted`
          : `NOT failed — child was satisfied: ${child.reason ?? ''}`,
        // NOT doesn't propagate matched signals
        matchedSignals: [],
      },
      nextState: {},
    }
  },
}
