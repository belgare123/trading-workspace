// ── ProfitFactorObjective — Maximize profit factor ──
//
// @since 3.5.4

import type { ObjectiveDefinition } from './ObjectiveDefinition'
import { requireMetric } from './ObjectiveDefinition'

export const ProfitFactorObjective: ObjectiveDefinition = {
  id: 'profit-factor',
  name: 'Profit Factor',
  description: 'Maximizes gross profit / gross loss ratio',
  higherIsBetter: true,
  calculate(metrics) {
    return requireMetric(metrics, 'profit-factor', 'Profit Factor')
  },
}
