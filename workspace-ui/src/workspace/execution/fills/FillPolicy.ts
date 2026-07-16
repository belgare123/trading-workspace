// ── FillPolicy — Determines how much of an order fills at once ──
//
// @since 3.5.1

import type { Order, MarketSnapshot, Fill } from '../types'

export interface FillPolicy {
  /**
   * Given an order and market, determine how many fills to produce.
   * Returns an array of partial fills (can be empty or partial).
   */
  determine(order: Order, market: MarketSnapshot, maxQuantity: number): Fill[]
}

/** Fill the entire remaining quantity at once */
export class FullFillPolicy implements FillPolicy {
  determine(order: Order, _market: MarketSnapshot, maxQuantity: number): Fill[] {
    if (maxQuantity <= 0) return []
    return [{
      id: `fill-${order.id}-${Date.now()}`,
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: maxQuantity,
      price: order.averagePrice,
      commission: 0,
      commissionAsset: 'USDT',
      slippage: 0,
      timestamp: Date.now(),
    }]
  }
}

/** Partial fill — split into smaller chunks (simulates liquidity) */
export class PartialFillPolicy implements FillPolicy {
  chunkSize: number

  constructor(chunkSize: number) {
    this.chunkSize = chunkSize
  }

  determine(order: Order, _market: MarketSnapshot, maxQuantity: number): Fill[] {
    if (maxQuantity <= 0) return []
    const fills: Fill[] = []
    let remaining = maxQuantity
    while (remaining > 0) {
      const chunk = Math.min(remaining, this.chunkSize)
      fills.push({
        id: `fill-${order.id}-${Date.now()}-${fills.length}`,
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        quantity: chunk,
        price: order.averagePrice,
        commission: 0,
        commissionAsset: 'USDT',
        slippage: 0,
        timestamp: Date.now(),
      })
      remaining -= chunk
    }
    return fills
  }
}
