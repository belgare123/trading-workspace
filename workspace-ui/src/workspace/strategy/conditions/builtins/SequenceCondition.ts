// ── SequenceCondition — children must satisfy in order ──
//
// Temporal sequence: children must become satisfied in order,
// one per bar, progressing through the sequence over time.
//
// State:
//   currentStep - index of the next child to satisfy (0 = start)
//   completed - whether the full sequence has been satisfied
//
// Once the full sequence completes, the condition fires once.
// Reset happens on invalidate() from ConditionRuntime.
//
// @since 3.4.4

import type { ConditionDefinition } from '../definition/ConditionDefinition'
import type { ConditionInput, ConditionEvaluationOutput } from '../definition/ConditionDefinition'
import { collectMatchedSignals } from '../utils/ConditionHelpers'

export const SequenceCondition: ConditionDefinition = {
  id: 'sequence',
  name: 'Sequence',
  description: 'Child conditions must satisfy in order over time',
  version: '1.0.0',

  async evaluate(input: ConditionInput): Promise<ConditionEvaluationOutput> {
    const { childResults, nodeState, params } = input

    if (childResults.length === 0) {
      return { result: { satisfied: false, reason: 'No child conditions' }, nextState: {} }
    }

    const currentStep = (nodeState.currentStep as number) ?? 0
    const completed = (nodeState.completed as boolean) ?? false
    const resetOnFail = (params.resetOnFail as boolean) ?? true

    // Already completed the sequence
    if (completed) {
      return {
        result: { satisfied: true, score: 1, reason: 'Sequence already completed' },
        nextState: { currentStep, completed },
      }
    }

    // Check if current step is satisfied
    if (currentStep < childResults.length) {
      const child = childResults[currentStep]
      if (child.satisfied) {
        // Move to next step
        const nextStep = currentStep + 1
        const allCompleted = nextStep >= childResults.length

        if (allCompleted) {
          return {
            result: {
              satisfied: true,
              score: 1,
              reason: `Sequence completed in ${childResults.length} steps`,
              matchedSignals: collectMatchedSignals(childResults),
            },
            nextState: { currentStep: nextStep, completed: true },
          }
        }

        // Step completed, waiting for next bar
        return {
          result: {
            satisfied: false,
            score: nextStep / childResults.length,
            reason: `Step ${currentStep + 1}/${childResults.length} completed, waiting for next`,
          },
          nextState: { currentStep: nextStep, completed: false },
        }
      }

      // Current step not satisfied
      if (resetOnFail && currentStep > 0) {
        // Reset to beginning if sequence was in progress
        return {
          result: {
            satisfied: false,
            score: 0,
            reason: `Sequence reset: step ${currentStep + 1} not satisfied`,
          },
          nextState: { currentStep: 0, completed: false },
        }
      }

      return {
        result: {
          satisfied: false,
          score: 0,
          reason: `Waiting for step ${currentStep + 1}/${childResults.length}`,
        },
        nextState: { currentStep, completed: false },
      }
    }

    return {
      result: { satisfied: true, score: 1, reason: 'Sequence completed' },
      nextState: { currentStep, completed: true },
    }
  },
}
