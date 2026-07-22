// ── FillAggregator — partial fills → VWAP ──

import { Order, type OrderId } from '../Order'
import type { Fill } from '../types'

export interface AggregatedFill {
  /** Final VWAP price */
  price: number
  /** Total filled quantity */
  quantity: number
  /** Total quote quantity (Σ price_i × qty_i) */
  quoteQuantity: number
  /** All raw fills */
  fills: Fill[]
  /** Number of partial fills received */
  fillCount: number
}

export class FillAggregator {
  /** Running aggregates by order ID */
  private aggregates = new Map<string, AggregatedFill>()

  /**
   * Record a partial fill for an order.
   * Returns the updated running aggregate.
   */
  addFill(orderId: string, fill: Fill): AggregatedFill {
    let agg = this.aggregates.get(orderId)

    if (!agg) {
      agg = {
        price: 0,
        quantity: 0,
        quoteQuantity: 0,
        fills: [],
        fillCount: 0,
      }
      this.aggregates.set(orderId, agg)
    }

    agg.fills.push(fill)
    agg.fillCount++

    // Update running VWAP (correctly accumulates even on first fill)
    const prevQty = agg.quantity
    const newQty = fill.quantity
    const newQuote = fill.price * newQty

    agg.quantity = prevQty + newQty
    agg.quoteQuantity = agg.quoteQuantity + (fill.quoteQuantity ?? fill.price * fill.quantity)
    agg.price = (prevQty === 0)
      ? fill.price
      : (agg.price * prevQty + newQuote) / agg.quantity

    // Also update Order model if provided
    if (fill.orderId) {
      // Update is done externally via OrderManager
    }

    return agg
  }

  /**
   * Get the current aggregate for an order without modifying it.
   */
  getAggregate(orderId: string): AggregatedFill | undefined {
    return this.aggregates.get(orderId)
  }

  /**
   * Finalize an order's fills. Returns the final aggregate and
   * clears internal state for this order.
   */
  finalize(orderId: string): AggregatedFill {
    const agg = this.aggregates.get(orderId)
    if (!agg) {
      return { price: 0, quantity: 0, quoteQuantity: 0, fills: [], fillCount: 0 }
    }
    this.aggregates.delete(orderId)
    return agg
  }

  /** Clear all aggregates (e.g. on shutdown) */
  clear(): void {
    this.aggregates.clear()
  }
}
