// ── CalmarMetric — Calmar Ratio ──
//
// Annualized return divided by maximum drawdown.
//
// @since 3.5.2

import type { MetricDefinition, MetricContext, MetricValue } from '../types'

export class CalmarMetric implements MetricDefinition {
  readonly id = 'calmar-ratio'
  readonly name = 'Calmar Ratio'
  readonly description = 'Annualized return divided by maximum drawdown'
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
    const totalReturn = first === 0 ? 0 : (last - first) / first

    // Estimate years from first to last timestamp
    const elapsedMs = points[points.length - 1].timestamp - points[0].timestamp
    const years = elapsedMs / (365.25 * 24 * 60 * 60 * 1000)
    const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : totalReturn

    // Compute max drawdown
    let peak = points[0].value
    let maxDd = 0
    for (const pt of points) {
      if (pt.value > peak) peak = pt.value
      const dd = peak > 0 ? (peak - pt.value) / peak : 0
      if (dd > maxDd) maxDd = dd
    }

    const value = maxDd === 0 ? (annualizedReturn > 0 ? 999 : 0) : annualizedReturn / maxDd

    return {
      id: this.id,
      name: this.name,
      value: isFinite(value) ? value : 999,
      formatted: isFinite(value) ? value.toFixed(2) : '∞',
      category: this.category,
      metadata: {
        annualizedReturn,
        maxDrawdown: maxDd,
        years,
        totalReturn,
      },
    }
  }
}
