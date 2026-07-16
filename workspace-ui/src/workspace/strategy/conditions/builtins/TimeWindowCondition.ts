// ── TimeWindowCondition — checks if current time is within a session window ──
//
// Contextual condition: uses ExecutionContext.TimeContext to determine
// if the current time falls within the configured trading session.
//
// Parameters:
//   sessionStart - session open time (HH:mm)
//   sessionEnd   - session close time (HH:mm)
//   timezone     - optional timezone
//
// @since 3.4.4

import type { ConditionDefinition } from '../definition/ConditionDefinition'
import type { ConditionInput, ConditionEvaluationOutput } from '../definition/ConditionDefinition'
import { isInTimeWindow } from '../utils/ConditionHelpers'

export const TimeWindowCondition: ConditionDefinition = {
  id: 'time-window',
  name: 'Time Window',
  description: 'Checks if current time is within a configured session window',
  version: '1.0.0',
  parameters: [
    { id: 'sessionStart', name: 'Session Start', type: 'string', default: '09:30', description: 'Session open time (HH:mm)' },
    { id: 'sessionEnd', name: 'Session End', type: 'string', default: '16:00', description: 'Session close time (HH:mm)' },
    { id: 'timezone', name: 'Timezone', type: 'string', default: 'UTC', description: 'Optional timezone override' },
  ],

  async evaluate(input: ConditionInput): Promise<ConditionEvaluationOutput> {
    const { ctx, params } = input
    const sessionStart = (params.sessionStart as string) ?? '09:30'
    const sessionEnd = (params.sessionEnd as string) ?? '16:00'

    const now = ctx.time.now()
    const inWindow = isInTimeWindow(now, sessionStart, sessionEnd)

    return {
      result: {
        satisfied: inWindow,
        score: inWindow ? 1 : 0,
        reason: inWindow
          ? `Within time window ${sessionStart}–${sessionEnd}`
          : `Outside time window ${sessionStart}–${sessionEnd}`,
      },
      nextState: {},
    }
  },
}
