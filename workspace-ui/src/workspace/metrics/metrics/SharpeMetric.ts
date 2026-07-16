// ── SharpeMetric — Sharpe Ratio ──
//
// Risk-adjusted return: (return - riskFree) / stdDev(returns).
// Uses equity curve returns for calculation.
//
// @since 3.5.2

import type { MetricDefinition, MetricContext, MetricValue } from '../types'

export class SharpeMetric implements MetricDefinition {
  readonly id = 'sharpe-ratio'
  readonly name = 'Sharpe Ratio'
  readonly description = 'Risk-adjusted return using standard deviation of returns'
  readonly category = 'risk' as const

  /** Annual risk-free rate (default: 0.05 = 5%) */
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
    const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (returns.length - 1)
    const stdDev = Math.sqrt(variance)

    if (stdDev === 0) {
      return {
        id: this.id,
        name: this.name,
        value: 0,
        formatted: 'N/A',
        category: this.category,
        metadata: { reason: 'Zero variance' },
      }
    }

    const rfPerPeriod = this.riskFreeRate / 252 // daily risk-free
    const value = (avgReturn - rfPerPeriod) / stdDev * Math.sqrt(252) // annualized

    return {
      id: this.id,
      name: this.name,
      value,
      formatted: value.toFixed(2),
      category: this.category,
      metadata: { avgReturn, stdDev, riskFreeRate: this.riskFreeRate, periods: returns.length },
    }
  }

  /** Compute percentage returns from equity points */
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
