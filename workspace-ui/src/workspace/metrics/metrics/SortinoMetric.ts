// ── SortinoMetric — Sortino Ratio ──
//
// Risk-adjusted return using downside deviation only.
//
// @since 3.5.2

import type { MetricDefinition, MetricContext, MetricValue } from '../types'

export class SortinoMetric implements MetricDefinition {
  readonly id = 'sortino-ratio'
  readonly name = 'Sortino Ratio'
  readonly description = 'Risk-adjusted return using downside deviation'
  readonly category = 'risk' as const

  private riskFreeRate: number

  constructor(riskFreeRate: number = 0.05) {
    this.riskFreeRate = riskFreeRate
  }

  compute(ctx: MetricContext): MetricValue {
    const returns = this.computeReturns(ctx.equityPoints)
    if (returns.length < 2) {
      return {
        id: this.id,
        name: this.name,
        value: 0,
        formatted: 'N/A',
        category: this.category,
        metadata: { reason: 'Insufficient data' },
      }
    }

    const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length
    const rfPerPeriod = this.riskFreeRate / 252

    // Downside deviation (only negative returns)
    const downsideVariance = returns
      .filter(r => r < 0)
      .reduce((s, r) => s + (r - rfPerPeriod) ** 2, 0) / returns.length
    const downsideDev = Math.sqrt(downsideVariance)

    if (downsideDev === 0) {
      return {
        id: this.id,
        name: this.name,
        value: returns.length > 0 ? 999 : 0,
        formatted: returns.length > 0 ? '∞' : 'N/A',
        category: this.category,
        metadata: { reason: 'No downside deviation' },
      }
    }

    const value = (avgReturn - rfPerPeriod) / downsideDev * Math.sqrt(252)

    return {
      id: this.id,
      name: this.name,
      value,
      formatted: value.toFixed(2),
      category: this.category,
      metadata: { avgReturn, downsideDev, riskFreeRate: this.riskFreeRate },
    }
  }

  private computeReturns(points: { value: number }[]): number[] {
    const returns: number[] = []
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1].value
      if (prev === 0) continue
      returns.push((points[i].value - prev) / prev)
    }
    return returns
  }
}
