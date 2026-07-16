// ── BarCloseFillModel — Orders fill at bar close price ──
//
// Simulates execution where orders are evaluated at the end of each bar.
// More realistic for OHLC-based backtests.
//
// @since 3.5.1

import type { FillModel, FillResult, Order, MarketSnapshot } from '../types'
import { OrderStatus } from '../types'
import { remainingQuantity } from '../orders/OrderLifecycle'

export class BarCloseFillModel implements FillModel {
  execute(order: Order, market: MarketSnapshot): FillResult {
    const qty = remainingQuantity(order)
    if (qty <= 0) {
      return { fills: [], remainingQuantity: 0, status: order.status }
    }

    // Use bar close price if available, otherwise last price
    const closePrice = market.bar?.close ?? market.last

    if (closePrice == null) {
      return { fills: [], remainingQuantity: qty, status: OrderStatus.ACCEPTED }
    }

    const fillPrice = order.side === 'buy'
      ? Math.max(closePrice, market.ask)
      : Math.min(closePrice, market.bid)

    const isComplete = order.type === 'market'
    const fillQty = isComplete ? qty : Math.min(qty, this.calculatePartialFill(order, market, fillPrice))

    if (fillQty <= 0) {
      return { fills: [], remainingQuantity: qty, status: OrderStatus.ACCEPTED }
    }

    return {
      fills: [{
        id: `fill-${order.id}-${Date.now()}`,
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        quantity: fillQty,
        price: fillPrice,
        commission: 0,
        commissionAsset: 'USDT',
        slippage: 0,
        timestamp: Date.now(),
      }],
      remainingQuantity: qty - fillQty,
      status: fillQty >= qty ? OrderStatus.FILLED : OrderStatus.PARTIALLY_FILLED,
    }
  }

  /** Simulate partial fill based on volume proportion */
  private calculatePartialFill(order: Order, market: MarketSnapshot, _price: number): number {
    const barVolume = market.bar?.volume ?? market.volume
    if (barVolume <= 0) return order.quantity

    // Assume this order can fill up to 10% of bar volume
    const maxFillByVolume = barVolume * 0.1
    return Math.min(order.quantity, maxFillByVolume)
  }
}
