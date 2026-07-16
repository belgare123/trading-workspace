// ── ProfitObjective — Maximize net profit ──
//
// @since 3.5.4

import type { ObjectiveDefinition } from './ObjectiveDefinition'

export const ProfitObjective: ObjectiveDefinition = {
  id: 'profit',
  name: 'Net Profit',
  description: 'Maximizes total net profit (end equity - start equity)',
  higherIsBetter: true,
  calculate(metrics) {
    const equity = metrics.equity
    return equity.current - equity.start
  },
}
