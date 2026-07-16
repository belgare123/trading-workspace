// ── OrderBook — Central order registry ──
//
// Maintains all orders. Thread-safe for synchronous ticks.
//
// @since 3.5.1

import type { Order, OrderRequest } from '../types'
import { createOrder } from './OrderLifecycle'

export class OrderBook {
  private orders: Map<string, Order> = new Map()
  private orderIdsByStrategy: Map<string, Set<string>> = new Map()

  /** Add a new order to the book */
  add(request: OrderRequest): Order {
    const order = createOrder(request)
    this.orders.set(order.id, order)

    const strategyOrders = this.orderIdsByStrategy.get(order.strategyId) ?? new Set()
    strategyOrders.add(order.id)
    this.orderIdsByStrategy.set(order.strategyId, strategyOrders)

    return order
  }

  /** Get order by ID */
  get(id: string): Order | undefined {
    return this.orders.get(id)
  }

  /** Update an existing order in place */
  update(id: string, updater: (order: Order) => Order): Order {
    const existing = this.orders.get(id)
    if (!existing) throw new Error(`Order ${id} not found`)
    const updated = updater(existing)
    this.orders.set(id, updated)
    return updated
  }

  /** All orders */
  all(): Order[] {
    return Array.from(this.orders.values())
  }

  /** Orders for a specific strategy */
  byStrategy(strategyId: string): Order[] {
    const ids = this.orderIdsByStrategy.get(strategyId)
    if (!ids) return []
    return Array.from(ids)
      .map(id => this.orders.get(id)!)
      .filter(Boolean)
  }

  /** Active orders (pending / accepted / partially filled) */
  active(): Order[] {
    return this.all().filter(o => isActiveStatus(o.status))
  }

  /** Clear all orders */
  clear(): void {
    this.orders.clear()
    this.orderIdsByStrategy.clear()
  }

  /** Total order count */
  get size(): number {
    return this.orders.size
  }
}

function isActiveStatus(status: string): boolean {
  return status === 'pending' || status === 'accepted' || status === 'partially_filled'
}
