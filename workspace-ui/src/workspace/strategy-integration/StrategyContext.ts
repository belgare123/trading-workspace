// ── StrategyContext — unified context for strategy onTick() ──
// Sprint 5.7 — StrategyRuntime Integration

import type { StrategyContext, StrategyTick, StrategyCandle } from './types'
import type { WalletSnapshot } from '../wallet/types'

/**
 * StrategyContextFactory — creates StrategyContext for each tick.
 * Wraps existing system state into the minimal context a strategy needs.
 */
export class StrategyContextFactory {
  create(params: {
    strategyId: string
    symbol: string
    tick: StrategyTick
    candles: readonly StrategyCandle[]
    wallet: WalletSnapshot
    hasOpenTrade: boolean
    hasPendingOrder: boolean
  }): StrategyContext {
    return {
      strategyId: params.strategyId,
      symbol: params.symbol,
      tick: params.tick,
      candles: params.candles,
      wallet: params.wallet,
      hasOpenTrade: params.hasOpenTrade,
      hasPendingOrder: params.hasPendingOrder,
      clock: Date.now(),
    }
  }
}
