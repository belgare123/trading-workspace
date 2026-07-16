// ── WinRateMetric — Win Rate ──
//
// @since 3.5.2

import type { MetricDefinition, MetricContext, MetricValue } from '../types'

export class WinRateMetric implements MetricDefinition {
  readonly id = 'win-rate'
  readonly name = 'Win Rate'
  readonly description = 'Ratio of winning trades to total trades'
  readonly category = 'trade' as const

  compute(ctx: MetricContext): MetricValue {
    const total = ctx.trades.length
    const wins = ctx.trades.filter(t => t.realizedPnl > 0).length
    const value = total === 0 ? 0 : wins / total

    return {
      id: this.id,
      name: this.name,
      value,
      formatted: `${(value * 100).toFixed(1)}%`,
      category: this.category,
      metadata: { wins, total, losses: total - wins },
    }
  }
}
