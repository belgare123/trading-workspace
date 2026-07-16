// ── OrderMatcher — Matches orders against market conditions ──
//
// Evaluates pending limit/stop orders each tick.
// Market orders are always eligible immediately.
//
// @since 3.5.1

import type { Order, MarketSnapshot } from '../types'
import { isActive, remainingQuantity } from './OrderLifecycle'

export class OrderMatcher {
  /**
   * Evaluate which pending orders can be filled given current market.
   * Returns orders whose trigger conditions are met.
   */
  evaluate(orders: Order[], market: MarketSnapshot): Order[] {
    return orders.filter(order => {
      if (!isActive(order.status)) return false
      if (remainingQuantity(order) <= 0) return false
      if (order.symbol !== market.symbol) return false
      return this.isTriggered(order, market)
    })
  }

  private isTriggered(order: Order, market: MarketSnapshot): boolean {
    const type = order.type

    if (type === 'market') {
      return true
    }

    if (type === 'limit') {
      // Buy limit: price ≤ ask (fill at limit or better)
      // Sell limit: price ≥ bid
      if (order.side === 'buy') {
        return order.price != null && market.ask <= order.price
      } else {
        return order.price != null && market.bid >= order.price
      }
    }

    if (type === 'stop') {
      // Buy stop: market price ≥ stop price
      // Sell stop: market price ≤ stop price
      if (order.side === 'buy') {
        return order.stopPrice != null && market.last >= order.stopPrice
      } else {
        return order.stopPrice != null && market.last <= order.stopPrice
      }
    }

    if (type === 'stop_limit') {
      // Triggered when stopPrice is hit, then becomes limit order
      const triggered = order.side === 'buy'
        ? order.stopPrice != null && market.last >= order.stopPrice
        : order.stopPrice != null && market.last <= order.stopPrice
      if (!triggered) return false
      // Then check limit price
      if (order.side === 'buy') {
        return order.price != null && market.ask <= order.price
      } else {
        return order.price != null && market.bid >= order.price
      }
    }

    return false
  }
}
