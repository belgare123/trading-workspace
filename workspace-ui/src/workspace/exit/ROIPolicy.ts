// ── ROIPolicy — take-profit by PnL% thresholds ──
// Sprint 5.5 — Exit Engine

import type { ExitPolicy } from './types'
import type { ROIPolicyConfig, ExitDecision } from './types'
import type { TradeContext } from '../trade'
import { ExitReason } from '../trade'
import { computePnLPct, POLICY_PRIORITY } from './types'

export class ROIPolicy implements ExitPolicy {
  readonly id = 'roi'
  private readonly config: ROIPolicyConfig

  constructor(config: ROIPolicyConfig) {
    if (!config.thresholds.length) throw new Error('ROIPolicy requires at least one threshold')
    // Sort descending so highest threshold is checked first (greedy exit)
    this.config = {
      thresholds: [...config.thresholds].sort((a, b) => b.pct - a.pct),
    }
  }

  evaluate(ctx: TradeContext): ExitDecision | null {
    const pnlPct = computePnLPct(ctx.trade, ctx.market.price)
    for (const t of this.config.thresholds) {
      if (pnlPct >= t.pct) {
        return {
          reason: ExitReason.TakeProfit,
          exitPrice: ctx.market.price,
          exitType: 'market',
          quantity: t.amount,
          priority: POLICY_PRIORITY.TAKE_PROFIT,
        }
      }
    }
    return null
  }
}
