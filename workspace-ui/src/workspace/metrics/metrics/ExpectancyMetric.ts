// ── ExpectancyMetric — Expectancy ──
//
// Average PnL per trade.
//
// @since 3.5.2

import type { MetricDefinition, MetricContext, MetricValue } from '../types'

export class ExpectancyMetric implements MetricDefinition {
  readonly id = 'expectancy'
  readonly name = 'Expectancy'
  readonly description = 'Average PnL per trade'
  readonly category = 'trade' as const

  compute(ctx: MetricContext): MetricValue {
    const total = ctx.trades.length
    const netPnl = ctx.trades.reduce((s, t) => s + t.realizedPnl, 0)
    const value = total === 0 ? 0 : netPnl / total

    return {
      id: this.id,
      name: this.name,
      value,
      formatted: `$${value.toFixed(2)}`,
      category: this.category,
      metadata: { netPnl, totalTrades: total },
    }
  }
}
