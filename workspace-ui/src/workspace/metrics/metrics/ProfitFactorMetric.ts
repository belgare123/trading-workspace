// ── ProfitFactorMetric — Profit Factor ──
//
// @since 3.5.2

import type { MetricDefinition, MetricContext, MetricValue } from '../types'

export class ProfitFactorMetric implements MetricDefinition {
  readonly id = 'profit-factor'
  readonly name = 'Profit Factor'
  readonly description = 'Gross profit divided by gross loss'
  readonly category = 'trade' as const

  compute(ctx: MetricContext): MetricValue {
    const grossProfit = ctx.trades
      .filter(t => t.realizedPnl > 0)
      .reduce((s, t) => s + t.realizedPnl, 0)

    const grossLoss = Math.abs(
      ctx.trades
        .filter(t => t.realizedPnl < 0)
        .reduce((s, t) => s + t.realizedPnl, 0),
    )

    const value = grossLoss === 0
      ? grossProfit > 0 ? Infinity : 0
      : grossProfit / grossLoss

    return {
      id: this.id,
      name: this.name,
      value: isFinite(value) ? value : 999,
      formatted: isFinite(value) ? value.toFixed(2) : '∞',
      category: this.category,
      metadata: { grossProfit, grossLoss },
    }
  }
}
