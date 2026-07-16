// ── SQNMetric — System Quality Number ──
//
// Sharpe-like metric: (avg trade / stdDev of trades) * sqrt(number of trades).
//
// @since 3.5.2

import type { MetricDefinition, MetricContext, MetricValue } from '../types'

export class SQNMetric implements MetricDefinition {
  readonly id = 'sqn'
  readonly name = 'System Quality Number (SQN)'
  readonly description = 'Quality of the trading system: (Expectancy / StdDev) * sqrt(N)'
  readonly category = 'risk' as const

  compute(ctx: MetricContext): MetricValue {
    const trades = ctx.trades
    if (trades.length < 2) {
      return {
        id: this.id,
        name: this.name,
        value: 0,
        formatted: 'N/A',
        category: this.category,
        metadata: { reason: 'Insufficient trades' },
      }
    }

    const pnls = trades.map(t => t.realizedPnl)
    const avg = pnls.reduce((s, p) => s + p, 0) / pnls.length
    const variance = pnls.reduce((s, p) => s + (p - avg) ** 2, 0) / (pnls.length - 1)
    const stdDev = Math.sqrt(variance)

    if (stdDev === 0) {
      return {
        id: this.id,
        name: this.name,
        value: avg > 0 ? 999 : 0,
        formatted: avg > 0 ? '∞' : '0.00',
        category: this.category,
      }
    }

    const value = avg / stdDev * Math.sqrt(pnls.length)

    const qualityLabel =
      value >= 6.0 ? 'Excellent' :
      value >= 5.0 ? 'Superb' :
      value >= 4.0 ? 'Good' :
      value >= 3.0 ? 'Decent' :
      value >= 2.0 ? 'Mediocre' :
      value >= 1.0 ? 'Poor' :
      'Very Poor'

    return {
      id: this.id,
      name: this.name,
      value,
      formatted: value.toFixed(2),
      category: this.category,
      metadata: {
        avgTrade: avg,
        stdDev,
        n: pnls.length,
        quality: qualityLabel,
      },
    }
  }
}
