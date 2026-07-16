// ── RiskReport — Aggregated risk metrics ──
//
// @since 3.5.2

import type { MetricsReport, MetricValue, Curve } from '../types'

export class RiskReport implements MetricsReport {
  readonly id = 'risk-report'
  readonly name = 'Risk Report'
  readonly timestamp: number
  readonly metrics: MetricValue[]
  readonly curves: Curve[]

  constructor(metrics: MetricValue[], curves: Curve[]) {
    this.timestamp = Date.now()
    this.metrics = metrics
    this.curves = curves
  }

  /** Max drawdown percentage */
  get maxDrawdown(): number {
    return (this.find('max-drawdown')?.value ?? 0) * 100
  }

  /** Sharpe ratio */
  get sharpe(): number {
    return this.find('sharpe-ratio')?.value ?? 0
  }

  /** Sortino ratio */
  get sortino(): number {
    return this.find('sortino-ratio')?.value ?? 0
  }

  /** Calmar ratio */
  get calmar(): number {
    return this.find('calmar-ratio')?.value ?? 0
  }

  /** Kelly criterion */
  get kelly(): number {
    return (this.find('kelly-criterion')?.value ?? 0) * 100
  }

  private find(id: string): MetricValue | undefined {
    return this.metrics.find(m => m.id === id)
  }
}
