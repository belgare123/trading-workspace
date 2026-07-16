// ── PendingOrders — Timer-based order management ──
//
// Tracks orders that should be re-evaluated on each tick/bar.
// Limit & stop orders live here until triggered.
//
// @since 3.5.1

import type { Order } from '../types'
import { isActive, remainingQuantity } from './OrderLifecycle'

export class PendingOrders {
  private pending: Map<string, Order> = new Map()

  /** Track a new pending order */
  add(order: Order): void {
    if (isActive(order.status) && remainingQuantity(order) > 0) {
      this.pending.set(order.id, order)
    }
  }

  /** Update tracked order */
  update(order: Order): void {
    if (!isActive(order.status) || remainingQuantity(order) <= 0) {
      this.pending.delete(order.id)
    } else {
      this.pending.set(order.id, order)
    }
  }

  /** Remove from tracking */
  remove(orderId: string): void {
    this.pending.delete(orderId)
  }

  /** All currently pending orders */
  all(): Order[] {
    return Array.from(this.pending.values())
  }

  /** Pending limit orders for a symbol */
  limitOrders(symbol: string): Order[] {
    return this.all().filter(o => o.symbol === symbol && o.type === 'limit')
  }

  /** Pending stop orders for a symbol */
  stopOrders(symbol: string): Order[] {
    return this.all().filter(o => o.symbol === symbol && (o.type === 'stop' || o.type === 'stop_limit'))
  }

  /** Number of pending orders */
  get size(): number {
    return this.pending.size
  }

  clear(): void {
    this.pending.clear()
  }
}
