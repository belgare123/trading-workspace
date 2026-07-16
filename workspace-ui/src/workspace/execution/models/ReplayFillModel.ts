// ── ReplayFillModel — Fill at exact historical prices ──
//
// For backtesting against recorded market data.
// Uses pre-recorded tick/bar data to determine fills.
//
// @since 3.5.1

import type { FillModel, FillResult, Order, MarketSnapshot } from '../types'
import { OrderStatus } from '../types'
import { remainingQuantity } from '../orders/OrderLifecycle'

export class ReplayFillModel implements FillModel {
  /**
   * Replay fill: uses the bar OHLC to determine fill price.
   * For limit orders, checks if price was reached during the bar.
   */
  execute(order: Order, market: MarketSnapshot): FillResult {
    const qty = remainingQuantity(order)
    if (qty <= 0) {
      return { fills: [], remainingQuantity: 0, status: order.status }
    }

    const bar = market.bar
    if (!bar) {
      // No bar data — use last price
      return this.fillAtPrice(order, market.last)
    }

    // Check if the order was triggered during this bar
    switch (order.type) {
      case 'market':
        return this.fillAtPrice(order, bar.close)

      case 'limit': {
        const reached = order.side === 'buy'
          ? bar.low <= order.price!
          : bar.high >= order.price!
        if (!reached) {
          return { fills: [], remainingQuantity: qty, status: OrderStatus.ACCEPTED }
        }
        // Fill at limit price or better
        const fillPrice = order.price!
        return this.fillAtPrice(order, fillPrice)
      }

      case 'stop': {
        const reached = order.side === 'buy'
          ? bar.high >= order.stopPrice!
          : bar.low <= order.stopPrice!
        if (!reached) {
          return { fills: [], remainingQuantity: qty, status: OrderStatus.ACCEPTED }
        }
        // Stop becomes market order, fill at bar close
        return this.fillAtPrice(order, bar.close)
      }

      case 'stop_limit': {
        const stopReached = order.side === 'buy'
          ? bar.high >= order.stopPrice!
          : bar.low <= order.stopPrice!
        if (!stopReached) {
          return { fills: [], remainingQuantity: qty, status: OrderStatus.ACCEPTED }
        }
        // Now becomes limit order
        const limitReached = order.side === 'buy'
          ? bar.low <= order.price!
          : bar.high >= order.price!
        if (!limitReached) {
          return { fills: [], remainingQuantity: qty, status: OrderStatus.ACCEPTED }
        }
        return this.fillAtPrice(order, order.price!)
      }

      default:
        return { fills: [], remainingQuantity: qty, status: OrderStatus.ACCEPTED }
    }
  }

  private fillAtPrice(order: Order, price: number): FillResult {
    const qty = remainingQuantity(order)
    return {
      fills: [{
        id: `fill-${order.id}-${Date.now()}`,
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        quantity: qty,
        price,
        commission: 0,
        commissionAsset: 'USDT',
        slippage: 0,
        timestamp: Date.now(),
      }],
      remainingQuantity: 0,
      status: OrderStatus.FILLED,
    }
  }
}
