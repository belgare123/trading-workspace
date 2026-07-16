// ── SortinoObjective — Maximize Sortino ratio ──
//
// @since 3.5.4

import type { ObjectiveDefinition } from './ObjectiveDefinition'
import { requireMetric } from './ObjectiveDefinition'

export const SortinoObjective: ObjectiveDefinition = {
  id: 'sortino',
  name: 'Sortino Ratio',
  description: 'Maximizes downside risk-adjusted return',
  higherIsBetter: true,
  calculate(metrics) {
    return requireMetric(metrics, 'sortino-ratio', 'Sortino Ratio')
  },
}
