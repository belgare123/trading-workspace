// ── RecoveryFactorMetric — Recovery Factor ──
//
// Net profit divided by maximum drawdown.
//
// @since 3.5.2

import type { MetricDefinition, MetricContext, MetricValue } from '../types'

export class RecoveryFactorMetric implements MetricDefinition {
  readonly id = 'recovery-factor'
  readonly name = 'Recovery Factor'
  readonly description = 'Net profit divided by maximum drawdown'
  readonly category = 'risk' as const

  compute(ctx: MetricContext): MetricValue {
    const points = ctx.equityPoints
    if (points.length < 2) {
      return {
        id: this.id,
        name: this.name,
        value: 0,
        formatted: 'N/A',
        category: this.category,
      }
    }

    const first = points[0].value
    const last = points[points.length - 1].value
    const netProfit = last - first

    // Compute max drawdown
    let peak = points[0].value
    let maxDd = 0
    for (const pt of points) {
      if (pt.value > peak) peak = pt.value
      const dd = peak > 0 ? (peak - pt.value) / peak : 0
      if (dd > maxDd) maxDd = dd
    }

    const maxDdAbs = peak * maxDd
    const value = maxDdAbs === 0 ? (netProfit > 0 ? 999 : 0) : netProfit / maxDdAbs

    return {
      id: this.id,
      name: this.name,
      value: isFinite(value) ? value : 999,
      formatted: isFinite(value) ? value.toFixed(2) : '∞',
      category: this.category,
      metadata: { netProfit, maxDrawdownAbsolute: maxDdAbs, peak },
    }
  }
}
