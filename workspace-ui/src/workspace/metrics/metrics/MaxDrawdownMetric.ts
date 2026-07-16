// ── MaxDrawdownMetric — Maximum Drawdown ──
//
// Largest peak-to-trough decline in the equity curve.
//
// @since 3.5.2

import type { MetricDefinition, MetricContext, MetricValue } from '../types'

export class MaxDrawdownMetric implements MetricDefinition {
  readonly id = 'max-drawdown'
  readonly name = 'Max Drawdown'
  readonly description = 'Maximum peak-to-trough decline in equity'
  readonly category = 'risk' as const

  compute(ctx: MetricContext): MetricValue {
    const points = ctx.equityPoints
    if (points.length < 2) {
      return {
        id: this.id,
        name: this.name,
        value: 0,
        formatted: '0.00%',
        category: this.category,
      }
    }

    let peak = points[0].value
    let maxDd = 0
    let peakTimestamp = 0
    let troughTimestamp = 0

    for (const pt of points) {
      if (pt.value > peak) {
        peak = pt.value
        peakTimestamp = pt.timestamp
      }
      const dd = peak > 0 ? (peak - pt.value) / peak : 0
      if (dd > maxDd) {
        maxDd = dd
        troughTimestamp = pt.timestamp
      }
    }

    return {
      id: this.id,
      name: this.name,
      value: maxDd,
      formatted: `${(maxDd * 100).toFixed(2)}%`,
      category: this.category,
      metadata: {
        peak,
        peakTimestamp,
        troughTimestamp,
        maxDrawdownValue: peak * (1 - maxDd),
      },
    }
  }
}
