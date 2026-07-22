// ── ExitController ──

import { Trade } from '../Trade'
import { TradeStatus, type Fill, type ExitReason } from '../types'
import type { IOrderManager } from './interfaces'

/**
 * ExitController handles trade exit lifecycle:
 * 1. requestClose() — place exit order → set ExitPending
 * 2. onPartialExitFill() — partial exit fill → auto-close when fully filled
 */
export class ExitController {
  /**
   * Request to close a trade.
   * - Places exit order via OrderManager.create() FIRST
   * - Then transitions to ExitPending with the real order ID
   */
  async requestClose(
    trade: Trade,
    reason: string,
    orderManager: IOrderManager,
    exitPrice?: number,
  ): Promise<void> {
    if (trade.isTerminal) return

    const quantity = trade.openQuantity
    if (quantity <= 0) return

    const side = trade.direction === 'long' ? 'sell' as const : 'buy' as const

    // Place exit order FIRST (trade still in Managing)
    const order = await orderManager.create({
      tradeId: trade.id,
      symbol: trade.symbol,
      side,
      type: exitPrice ? 'limit' : 'market',
      quantity,
      price: exitPrice,
      reduceOnly: true,
    })

    // Now transition to ExitPending with the REAL order ID
    trade.setExitPending(order.id, reason as ExitReason)
  }

  /** Handle partial exit fill */
  onPartialExitFill(trade: Trade, fill: Fill): void {
    if (trade.status !== TradeStatus.ExitPending && trade.status !== TradeStatus.ExitPartial) {
      return
    }
    const pnl = this.calculateExitPnL(trade, fill.price, fill.quantity)
    trade.addExitFill(fill, 'signal' as ExitReason, pnl, 0)
  }

  /** Calculate PnL for an exit fill */
  private calculateExitPnL(trade: Trade, exitPrice: number, quantity: number): number {
    if (!trade.entry) return 0
    if (trade.direction === 'long') {
      return (exitPrice - trade.entry.price) * quantity
    } else {
      return (trade.entry.price - exitPrice) * quantity
    }
  }
}
