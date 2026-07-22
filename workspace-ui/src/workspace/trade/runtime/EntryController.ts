// ── EntryController ──

import { Trade } from '../Trade'
import {
  TradeStatus,
  Direction,
  OrderSide,
  OrderType,
  type Fill,
} from '../types'
import type { TradeSignal, IOrderManager } from './interfaces'

/**
 * EntryController handles trade entry lifecycle:
 * 1. open() — create Trade + place entry order via IOrderManager
 * 2. onOrderAccepted() — order accepted by exchange
 * 3. onPartialFill() — partial fill received
 * 4. onFilled() — order fully filled → completeEntry → setManaging
 * 5. onCancelled() — entry cancelled → cancel trade
 * 6. onRejected() — entry rejected → reject trade
 */
export class EntryController {
  /**
   * Open a new trade.
   * - Creates Trade in Created state
   * - Places entry order via OrderManager.create() FIRST
   * - Then transitions to EntryPending with the real order ID
   * - Returns the Trade
   */
  async open(
    signal: TradeSignal,
    orderManager: IOrderManager,
  ): Promise<Trade> {
    const trade = Trade.create({
      strategyId: signal.strategyId,
      symbol: signal.symbol,
      direction: signal.direction,
    })

    // Calculate side from direction
    const side = signal.direction === Direction.Long ? OrderSide.Buy : OrderSide.Sell

    // Determine quantity (signal specifies or default)
    const quantity = signal.quantity ?? 0

    if (quantity <= 0) {
      trade.reject('invalid quantity')
      return trade
    }

    // Place order via OrderManager FIRST (trade still in Created)
    const order = await orderManager.create({
      tradeId: trade.id,
      symbol: signal.symbol,
      side,
      type: signal.type,
      quantity,
      price: signal.price,
      reduceOnly: false,
      timeInForce: signal.timeInForce,
    })

    // Now transition to EntryPending with the REAL order ID
    trade.setEntryPending(order.id)

    // Store signal metadata
    if (signal.metadata) {
      Object.assign(trade.metadata, signal.metadata)
    }
    if (signal.stopLoss) {
      trade.metadata.stopLoss = signal.stopLoss
    }
    if (signal.takeProfit) {
      trade.metadata.takeProfit = signal.takeProfit
    }

    return trade
  }

  /** Order has been accepted by the exchange (still pending) */
  onOrderAccepted(trade: Trade): void {
    if (trade.status !== TradeStatus.EntryPending) {
      return  // No-op if not in entry
    }
    // Status remains EntryPending until fill
  }

  /** Partial fill received → update trade entry */
  onPartialFill(trade: Trade, fill: Fill): void {
    if (trade.status === TradeStatus.EntryPending || trade.status === TradeStatus.EntryPartial) {
      trade.addEntryFill(fill)
    }
  }

  /** Order fully filled → complete entry, transition to Managing */
  onFilled(trade: Trade): void {
    if (trade.status === TradeStatus.EntryPending || trade.status === TradeStatus.EntryPartial) {
      trade.completeEntry()
      trade.setManaging()
    }
  }

  /** Entry order cancelled → cancel the trade */
  onCancelled(trade: Trade): void {
    if (trade.status === TradeStatus.EntryPending || trade.status === TradeStatus.EntryPartial) {
      trade.cancel()
    }
  }

  /** Entry order rejected → reject the trade */
  onRejected(trade: Trade, reason: string): void {
    if (trade.status === TradeStatus.EntryPending) {
      trade.reject(reason)
    }
  }
}
