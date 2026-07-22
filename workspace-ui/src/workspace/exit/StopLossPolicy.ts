// ── StopLossPolicy — stop-loss by fixed%, ATR, or price level ──
// Sprint 5.5 — Exit Engine

import type { ExitPolicy } from './types'
import type { StopLossPolicyConfig } from './types'
import type { TradeContext } from '../trade'
import { ExitReason } from '../trade'
import { computePnLPct, POLICY_PRIORITY } from './types'

export class StopLossPolicy implements ExitPolicy {
  readonly id = 'stop-loss'
  private readonly config: StopLossPolicyConfig

  constructor(config: StopLossPolicyConfig) {
    if (config.value >= 0) throw new Error('StopLossPolicy value must be negative')
    this.config = config
  }

  evaluate(ctx: TradeContext): ExitDecision | null {
    const entry = ctx.trade.entry
    if (!entry) return null

    let stopPrice: number | null = null

    switch (this.config.mode) {
      case 'fixed': {
        const pnlPct = computePnLPct(ctx.trade, ctx.market.price)
        if (pnlPct <= this.config.value) {
          stopPrice = ctx.market.price
        }
        break
      }
      case 'price-level': {
        if (this.config.priceLevel === undefined) return null
        if (ctx.trade.direction === 'long' && ctx.market.price <= this.config.priceLevel) {
          stopPrice = this.config.priceLevel
        } else if (ctx.trade.direction === 'short' && ctx.market.price >= this.config.priceLevel) {
          stopPrice = this.config.priceLevel
        }
        break
      }
      case 'atr': {
        const atr = ctx.market.volume24h
          ? (ctx.market.spread * (this.config.atrMultiplier ?? 2))
          : null
        if (atr) {
          const threshold = ctx.trade.direction === 'long'
            ? entry.price - atr
            : entry.price + atr
          if (ctx.trade.direction === 'long' && ctx.market.price <= threshold) {
            stopPrice = threshold
          } else if (ctx.trade.direction === 'short' && ctx.market.price >= threshold) {
            stopPrice = threshold
          }
        }
        break
      }
      case 'trailing': {
        // Trailing stop handled by TrailingPolicy; here we fall through
        return null
      }
    }

    if (stopPrice !== null) {
      return {
        reason: ExitReason.StopLoss,
        exitPrice: stopPrice,
        exitType: 'market',
        quantity: 'all',
        priority: POLICY_PRIORITY.STOP_LOSS,
      }
    }
    return null
  }
}
