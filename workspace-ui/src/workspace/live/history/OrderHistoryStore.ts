/**
 * OrderHistoryStore.ts — Complete order lifecycle tracking
 *
 * Records every status transition, fill, and modification
 * for each order processed by the platform.
 *
 * @since 4.4
 */

import type { Order, Fill } from '../../execution/types'
import { OrderStatus } from '../../execution/types'
import type { OrderHistoryEntry } from './types'

export class OrderHistoryStore {
  private orders = new Map<string, OrderHistoryEntry>()
  private maxEntries: number

  constructor(maxEntries = 5_000) {
    this.maxEntries = maxEntries
  }

  /** Record order submission / initial state */
  recordOrder(order: Order): OrderHistoryEntry {
    const existing = this.orders.get(order.id)
    if (existing) return this.updateStatus(order)

    const entry: OrderHistoryEntry = {
      orderId: order.id,
      strategyId: order.strategyId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      price: order.price,
      stopPrice: order.stopPrice,
      status: order.status,
      transitions: [{
        from: order.status as OrderStatus,
        to: order.status,
        timestamp: order.createdAt,
        reason: 'created',
      }],
      filledQuantity: 0,
      averagePrice: 0,
      commission: 0,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }

    this.orders.set(order.id, entry)
    this.trim()
    return entry
  }

  /** Record a status transition */
  updateStatus(order: Order): OrderHistoryEntry {
    const entry = this.orders.get(order.id)
    if (!entry) return this.recordOrder(order)

    const prev = entry.status
    entry.status = order.status
    entry.updatedAt = order.updatedAt

    // Record transition
    entry.transitions.push({
      from: prev,
      to: order.status,
      timestamp: order.updatedAt,
    })

    if (order.status === OrderStatus.FILLED && !entry.filledAt) {
      entry.filledAt = order.updatedAt
    }
    if (order.status === OrderStatus.CANCELLED) {
      entry.cancelledAt = order.updatedAt
    }
    if (order.status === OrderStatus.FILLED || order.status === OrderStatus.PARTIALLY_FILLED) {
      entry.filledQuantity = order.filledQuantity
      entry.averagePrice = order.averagePrice
      entry.commission = order.commission
    }

    return entry
  }

  /** Record a specific fill event */
  recordFill(order: Order, fill: Fill): OrderHistoryEntry {
    const entry = this.orders.get(order.id)
    if (!entry) return this.recordOrder(order)

    entry.filledQuantity = order.filledQuantity
    entry.averagePrice = order.averagePrice
    entry.commission += fill.commission

    entry.transitions.push({
      from: order.status,
      to: order.status,
      timestamp: fill.timestamp,
      reason: 'fill',
      fillQuantity: fill.quantity,
      fillPrice: fill.price,
    })

    return entry
  }

  /** Get history entry for a specific order */
  getOrder(orderId: string): OrderHistoryEntry | undefined {
    return this.orders.get(orderId)
  }

  /** Get all orders for a strategy */
  getByStrategy(strategyId: string): OrderHistoryEntry[] {
    return Array.from(this.orders.values()).filter(o => o.strategyId === strategyId)
  }

  /** Get all orders for a symbol */
  getBySymbol(symbol: string): OrderHistoryEntry[] {
    return Array.from(this.orders.values()).filter(o => o.symbol === symbol)
  }

  /** Get all orders matching status */
  getByStatus(status: OrderStatus): OrderHistoryEntry[] {
    return Array.from(this.orders.values()).filter(o => o.status === status)
  }

  /** Get recent orders */
  getRecent(n = 50): OrderHistoryEntry[] {
    return Array.from(this.orders.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, n)
  }

  /** All entries */
  all(): OrderHistoryEntry[] {
    return Array.from(this.orders.values())
  }

  /** Count */
  get size(): number {
    return this.orders.size
  }

  /** Clear */
  clear(): void {
    this.orders.clear()
  }

  private trim(): void {
    if (this.orders.size <= this.maxEntries) return
    const sorted = Array.from(this.orders.entries())
      .sort(([, a], [, b]) => a.createdAt - b.createdAt)
    const toRemove = sorted.slice(0, sorted.length - this.maxEntries)
    for (const [id] of toRemove) {
      this.orders.delete(id)
    }
  }
}
