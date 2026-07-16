// ── PerformanceReport — Aggregated trade + performance metrics ──
//
// @since 3.5.2

import type { MetricsReport, MetricValue, Curve } from '../types'

export class PerformanceReport implements MetricsReport {
  readonly id = 'performance-report'
  readonly name = 'Performance Report'
  readonly timestamp: number
  readonly metrics: MetricValue[]
  readonly curves: Curve[]

  constructor(metrics: MetricValue[], curves: Curve[]) {
    this.timestamp = Date.now()
    this.metrics = metrics
    this.curves = curves
  }

  /** Net profit */
  get netProfit(): number {
    return this.find('expectancy')?.metadata?.netPnl as number ?? 0
  }

  /** Win rate percentage */
  get winRate(): number {
    return (this.find('win-rate')?.value ?? 0) * 100
  }

  /** Profit factor */
  get profitFactor(): number {
    return this.find('profit-factor')?.value ?? 0
  }

  /** Number of trades */
  get totalTrades(): number {
    return this.find('win-rate')?.metadata?.total as number ?? 0
  }

  /** Total commission */
  get totalCommission(): number {
    return this.metrics
      .filter(m => m.id === 'expectancy')
      .reduce((s, m) => s + ((m.metadata?.netPnl as number) ?? 0), 0) > 0
      ? 0
      : 0
  }

  private find(id: string): MetricValue | undefined {
    return this.metrics.find(m => m.id === id)
  }
}
