// ── FillEngine — Orchestrates fill generation ──
//
// Takes triggered orders, applies slippage, commission, and fill policy.
//
// @since 3.5.1

import type { Order, MarketSnapshot, Fill, SlippageModel, CommissionModel } from '../types'
import type { FillPolicy } from './FillPolicy'
import { remainingQuantity } from '../orders/OrderLifecycle'

export class FillEngine {
  slippageModel: SlippageModel
  commissionModel: CommissionModel
  fillPolicy: FillPolicy

  constructor(
    slippageModel: SlippageModel,
    commissionModel: CommissionModel,
    fillPolicy: FillPolicy,
  ) {
    this.slippageModel = slippageModel
    this.commissionModel = commissionModel
    this.fillPolicy = fillPolicy
  }

  /**
   * Process a triggered order against current market.
   * Returns fills with commission and slippage applied.
   */
  execute(order: Order, market: MarketSnapshot): { fills: Fill[]; remainingQty: number } {
    const maxQty = remainingQuantity(order)
    if (maxQty <= 0) return { fills: [], remainingQty: 0 }

    // Calculate slippage-adjusted price
    const slippage = this.slippageModel.calculate({
      side: order.side,
      quantity: maxQty,
      price: market.last,
      market,
      orderType: order.type,
    })

    const fillPrice = order.side === 'buy'
      ? market.ask + slippage
      : market.bid - slippage

    const adjustedOrder = { ...order, averagePrice: fillPrice }

    // Determine fills via policy
    const rawFills = this.fillPolicy.determine(adjustedOrder, market, maxQty)

    // Apply commission to each fill
    const fills: Fill[] = rawFills.map(f => {
      const commission = this.commissionModel.calculate({
        symbol: f.symbol,
        side: f.side,
        quantity: f.quantity,
        price: fillPrice,
        orderType: order.type,
      })
      return {
        ...f,
        price: fillPrice,
        commission,
        slippage,
      }
    })

    const totalFilled = fills.reduce((s, f) => s + f.quantity, 0)
    return { fills, remainingQty: maxQty - totalFilled }
  }
}
