// ── ManageController ──

import { Trade } from '../Trade'
import { TradeStatus } from '../types'
import type { TradeContext } from '../TradeContext'
import { createTradeContext } from '../TradeContext'
import type { MarketSnapshot } from '../../execution/types'
import type { IExitEngine, ExitDecision } from './interfaces'

/**
 * ManageController handles Managing state:
 * 1. onMarketTick() — update PnL, evaluate ExitEngine
 * 2. updateStopLoss() — store SL in trade metadata
 * 3. updateTakeProfit() — store TP in trade metadata
 *
 * Returns a Map<tradeId, ExitDecision> if ExitEngine signals one.
 */
export class ManageController {
  /**
   * Process market tick for all managing trades.
   * - Updates unrealized PnL
   * - Evaluates ExitEngine for each relevant trade
   * - Returns decisions for trades that need to exit
   */
  onMarketTick(
    trades: Trade[],
    market: MarketSnapshot,
    exitEngine: IExitEngine,
    walletSnapshot: { total: number; free: number; reserved: number },
    contextOverrides?: {
      risk?: TradeContext['risk']
      history?: TradeContext['history']
      strategy?: TradeContext['strategy']
    },
  ): Map<string, ExitDecision> {
    const decisions = new Map<string, ExitDecision>()

    for (const trade of trades) {
      if (trade.status !== TradeStatus.Managing) continue
      if (trade.symbol !== market.symbol) continue

      // Update unrealized PnL
      const pnl = this.calculateUnrealizedPnL(trade, market.last)
      trade.updateUnrealizedPnL(pnl)

      // Build TradeContext for ExitEngine evaluation
      const spread = market.ask - market.bid
      const ctx: TradeContext = {
        trade,
        market: {
          symbol: market.symbol,
          price: market.last,
          bid: market.bid,
          ask: market.ask,
          spread: spread > 0 ? spread : 0,
          timestamp: market.timestamp,
          volume24h: market.volume,
        },
        wallet: {
          total: walletSnapshot.total,
          free: walletSnapshot.free,
          reserved: walletSnapshot.reserved,
          margin: 0,
          leverage: 1,
          exposure: trade.openQuantity * market.last,
          currency: 'USDT',
        },
        risk: contextOverrides?.risk ?? {
          dailyLoss: 0,
          dailyLossLimit: 0,
          drawdown: 0,
          drawdownLimit: 0,
          openPositions: 0,
          maxOpenPositions: 0,
          isKillSwitchActive: false,
        },
        history: contextOverrides?.history ?? {
          trades: [],
          totalTrades: 0,
          winRate: 0,
          totalPnL: 0,
        },
        strategy: contextOverrides?.strategy ?? {
          id: trade.strategyId,
          name: trade.strategyId,
          version: '1.0',
        },
      }

      const decision = exitEngine.evaluate(ctx)
      if (decision) {
        decisions.set(trade.id, decision)
      }
    }

    return decisions
  }

  /** Update stop loss price in trade metadata */
  updateStopLoss(trade: Trade, price: number): void {
    if (trade.status !== TradeStatus.Managing) return
    trade.metadata.stopLoss = price
  }

  /** Update take profit price in trade metadata */
  updateTakeProfit(trade: Trade, price: number): void {
    if (trade.status !== TradeStatus.Managing) return
    trade.metadata.takeProfit = price
  }

  /** Calculate unrealized PnL for a trade at current price */
  private calculateUnrealizedPnL(trade: Trade, currentPrice: number): number {
    if (!trade.entry) return 0
    const { quantity, price } = trade.entry
    if (trade.direction === 'long') {
      return (currentPrice - price) * quantity
    } else {
      return (price - currentPrice) * quantity
    }
  }
}
