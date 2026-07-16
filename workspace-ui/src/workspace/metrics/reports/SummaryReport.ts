// ── SummaryReport — Key metrics at a glance ──
//
// @since 3.5.2

import type { MetricsReport, MetricValue, Curve } from '../types'

export class SummaryReport implements MetricsReport {
  readonly id = 'summary-report'
  readonly name = 'Summary Report'
  readonly timestamp: number
  readonly metrics: MetricValue[]
  readonly curves: Curve[]

  constructor(metrics: MetricValue[], curves: Curve[]) {
    this.timestamp = Date.now()
    this.metrics = metrics
    this.curves = curves
  }

  /** Only the most important metrics */
  get headline(): MetricValue[] {
    const ids = new Set([
      'win-rate',
      'profit-factor',
      'expectancy',
      'max-drawdown',
      'sharpe-ratio',
      'sqn',
    ])
    return this.metrics.filter(m => ids.has(m.id))
  }
}
