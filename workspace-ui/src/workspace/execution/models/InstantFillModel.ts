// ── InstantFillModel — All orders fill immediately ──
//
// Ideal for paper trading and simple backtests.
// Assumes infinite liquidity at current price.
//
// @since 3.5.1

import type { FillModel, FillResult, Order, MarketSnapshot } from '../types'
import { OrderStatus } from '../types'
import { remainingQuantity } from '../orders/OrderLifecycle'

export class InstantFillModel implements FillModel {
  execute(order: Order, market: MarketSnapshot): FillResult {
    const qty = remainingQuantity(order)
    if (qty <= 0) {
      return { fills: [], remainingQuantity: 0, status: order.status }
    }

    const fillPrice = order.side === 'buy' ? market.ask : market.bid

    return {
      fills: [{
        id: `fill-${order.id}-${Date.now()}`,
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        quantity: qty,
        price: fillPrice,
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
