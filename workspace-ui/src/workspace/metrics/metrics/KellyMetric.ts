// ── KellyMetric — Kelly Criterion ──
//
// Optimal fraction of capital to risk per trade:
//   f* = (W * (1 + R/W) - 1) / R
// Simplified: f* = W - (1 - W) / (R)
// where W = win rate, R = avg win / avg loss
//
// @since 3.5.2

import type { MetricDefinition, MetricContext, MetricValue } from '../types'

export class KellyMetric implements MetricDefinition {
  readonly id = 'kelly-criterion'
  readonly name = 'Kelly Criterion'
  readonly description = 'Optimal fraction of capital to risk per trade'
  readonly category = 'risk' as const

  compute(ctx: MetricContext): MetricValue {
    const trades = ctx.trades
    if (trades.length < 1) {
      return {
        id: this.id,
        name: this.name,
        value: 0,
        formatted: '0.00%',
        category: this.category,
      }
    }

    const wins = trades.filter(t => t.realizedPnl > 0)
    const losses = trades.filter(t => t.realizedPnl < 0)

    if (wins.length === 0 || losses.length === 0) {
      return {
        id: this.id,
        name: this.name,
        value: wins.length > 0 ? 1 : 0,
        formatted: wins.length > 0 ? '100.00%' : '0.00%',
        category: this.category,
        metadata: { warning: wins.length > 0 ? 'No losses' : 'No wins' },
      }
    }

    const winRate = wins.length / trades.length
    const avgWin = wins.reduce((s, t) => s + t.realizedPnl, 0) / wins.length
    const avgLoss = Math.abs(losses.reduce((s, t) => s + t.realizedPnl, 0)) / losses.length
    const winLossRatio = avgLoss === 0 ? 999 : avgWin / avgLoss

    // f = W - (1-W) / R
    const value = winRate - (1 - winRate) / winLossRatio
    const clamped = Math.max(0, Math.min(value, 0.5)) // practical Kelly: clamp to 0-50%

    return {
      id: this.id,
      name: this.name,
      value: clamped,
      formatted: `${(clamped * 100).toFixed(1)}%`,
      category: this.category,
      metadata: {
        fullKelly: value,
        winRate,
        avgWin,
        avgLoss,
        winLossRatio,
        warning: value > 0.25 ? 'Kelly suggests >25% — consider half-Kelly' : undefined,
      },
    }
  }
}
