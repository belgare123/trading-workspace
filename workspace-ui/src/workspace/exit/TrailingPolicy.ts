// ── TrailingPolicy — trailing stop by PnL% ──
// Sprint 5.5 — Exit Engine

import type { ExitPolicy } from './types'
import type { TrailingPolicyConfig } from './types'
import type { TradeContext } from '../trade'
import { ExitReason } from '../trade'
import { computePnLPct, POLICY_PRIORITY } from './types'

/**
 * Tracks per-trade peak PnL in memory.
 * On each evaluate(), updates the peak if current PnL is higher,
 * then checks if current PnL has dropped below peak - distance.
 */
export class TrailingPolicy implements ExitPolicy {
  readonly id = 'trailing'
  private readonly config: TrailingPolicyConfig
  /** tradeId → peak PnL% (non-persistent — resets on restart) */
  private readonly peaks = new Map<string, number>()

  constructor(config: TrailingPolicyConfig) {
    this.config = config
  }

  /** Exposed for testing */
  getPeak(tradeId: string): number | undefined {
    return this.peaks.get(tradeId)
  }

  /** Reset peak for a trade (e.g. on entry) */
  resetPeak(tradeId: string): void {
    this.peaks.delete(tradeId)
  }

  evaluate(ctx: TradeContext): ExitDecision | null {
    const { trade, market } = ctx
    if (!trade.entry) return null

    const pnlPct = computePnLPct(trade, market.price)
    const tradeId = trade.id

    // Not yet in profit territory — skip
    if (pnlPct < this.config.activationPct) {
      // Reset peak if we fall below activation (don't lock in stale high)
      this.peaks.delete(tradeId)
      return null
    }

    // Update peak
    const currentPeak = this.peaks.get(tradeId) ?? pnlPct
    const newPeak = Math.max(currentPeak, pnlPct)
    this.peaks.set(tradeId, newPeak)

    // Check if latest peak is high enough to re-arm stop (step-based tightening)
    const stepArmed = newPeak - currentPeak >= this.config.stepPct
    // The actual stop level: peak minus distance
    const stopLevel = newPeak - this.config.distancePct

    // If current PnL below stop level → exit
    if (pnlPct <= stopLevel || (stepArmed && pnlPct <= newPeak - this.config.offsetPct)) {
      return {
        reason: ExitReason.TrailingStop,
        exitPrice: market.price,
        exitType: 'market',
        quantity: 'all',
        priority: POLICY_PRIORITY.TRAILING,
      }
    }

    return null
  }
}
