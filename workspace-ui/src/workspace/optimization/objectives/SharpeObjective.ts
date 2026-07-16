// ── SharpeObjective — Maximize Sharpe ratio ──
//
// @since 3.5.4

import type { ObjectiveDefinition } from './ObjectiveDefinition'
import { requireMetric } from './ObjectiveDefinition'

export const SharpeObjective: ObjectiveDefinition = {
  id: 'sharpe',
  name: 'Sharpe Ratio',
  description: 'Maximizes risk-adjusted return (Sharpe Ratio)',
  higherIsBetter: true,
  calculate(metrics) {
    return requireMetric(metrics, 'sharpe-ratio', 'Sharpe Ratio')
  },
}
