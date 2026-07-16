// ── MaxDrawdownObjective — Minimize maximum drawdown ──
//
// @since 3.5.4

import type { ObjectiveDefinition } from './ObjectiveDefinition'
import { requireMetric } from './ObjectiveDefinition'

export const MaxDrawdownObjective: ObjectiveDefinition = {
  id: 'max-drawdown',
  name: 'Max Drawdown',
  description: 'Minimizes the maximum peak-to-trough drawdown',
  higherIsBetter: false,
  calculate(metrics) {
    // Drawdown is positive as a metric (0.05 = 5% drawdown)
    // Lower is better, so negate for scoring
    return requireMetric(metrics, 'max-drawdown', 'Max Drawdown')
  },
}
