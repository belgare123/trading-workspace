// ── DrawdownCondition — checks portfolio drawdown via ExecutionContext ──
//
// Contextual condition: examines portfolio drawdown from
// ExecutionContext.PortfolioContext.
//
// Modes:
//   'above-threshold'  — drawdown exceeds threshold (danger)
//   'below-threshold'  — drawdown within acceptable range
//   'recovery'         — drawdown is recovering (decreasing)
//
// Parameters:
//   mode       - check mode
//   threshold  - max acceptable drawdown (0.0–1.0)
//
// @since 3.4.4

import type { ConditionDefinition, ConditionEvaluationOutput } from '../definition/ConditionDefinition'
import type { ConditionInput } from '../types'

export const DrawdownCondition: ConditionDefinition = {
  id: 'drawdown',
  name: 'Drawdown',
  description: 'Checks portfolio drawdown against a threshold',
  version: '1.0.0',
  parameters: [
    { id: 'mode', name: 'Mode', type: 'select', default: 'below-threshold', description: 'Check mode', options: ['above-threshold', 'below-threshold', 'recovery'] },
    { id: 'threshold', name: 'Drawdown Threshold', type: 'number', default: 0.1, description: 'Max acceptable drawdown (0.0–1.0)', min: 0, max: 1 },
  ],

  async evaluate(input: ConditionInput): Promise<ConditionEvaluationOutput> {
    const { ctx, params, nodeState } = input
    const mode = (params.mode as string) ?? 'below-threshold'
    const threshold = (params.threshold as number) ?? 0.1

    const portfolioSummary = await ctx.portfolio.summary()
    const currentDrawdown = portfolioSummary.drawdown ?? 0

    switch (mode) {
      case 'above-threshold': {
        const exceeded = currentDrawdown >= threshold
        return {
          result: {
            satisfied: exceeded,
            score: exceeded ? Math.min(currentDrawdown / threshold, 1) : 0,
            reason: exceeded
              ? `Drawdown ${(currentDrawdown * 100).toFixed(1)}% exceeds threshold ${(threshold * 100).toFixed(1)}%`
              : `Drawdown ${(currentDrawdown * 100).toFixed(1)}% within limits`,
          },
          nextState: {},
        }
      }

      case 'below-threshold': {
        const safe = currentDrawdown < threshold
        return {
          result: {
            satisfied: safe,
            score: safe ? 1 - (currentDrawdown / threshold) : 0,
            reason: safe
              ? `Drawdown ${(currentDrawdown * 100).toFixed(1)}% below ${(threshold * 100).toFixed(1)}% threshold`
              : `Drawdown ${(currentDrawdown * 100).toFixed(1)}% exceeds ${(threshold * 100).toFixed(1)}%`,
          },
          nextState: {},
        }
      }

      case 'recovery': {
        const prevDrawdown = (nodeState.prevDrawdown as number) ?? currentDrawdown
        const isRecovering = currentDrawdown < prevDrawdown || currentDrawdown === 0
        return {
          result: {
            satisfied: isRecovering,
            score: isRecovering ? Math.max(0, 1 - currentDrawdown) : 0,
            reason: isRecovering
              ? `Drawdown recovering: ${(prevDrawdown * 100).toFixed(1)}% → ${(currentDrawdown * 100).toFixed(1)}%`
              : `Drawdown worsening: ${(prevDrawdown * 100).toFixed(1)}% → ${(currentDrawdown * 100).toFixed(1)}%`,
          },
          nextState: { prevDrawdown: currentDrawdown },
        }
      }

      default:
        return { result: { satisfied: false, reason: `Unknown mode: ${mode}` }, nextState: {} }
    }
  },
}
