// ── OrderTracker — единственный владелец активных ордеров ──

import { Order, type OrderId } from '../Order'
import {
  OrderTrackerState,
  ORDER_TRACKER_TRANSITIONS,
  type OrderTrackerState as OTS,
} from './types'

export class OrderTracker {
  /** Active orders by order ID */
  private orders = new Map<string, { order: Order; state: OTS }>()
  /** Index by tradeId for fast lookup */
  private byTrade = new Map<string, Set<string>>()

  /** Add a new order in Active state */
  add(order: Order): void {
    if (this.orders.has(order.id)) {
      return // idempotent
    }
    this.orders.set(order.id, { order, state: OrderTrackerState.Active })
    if (order.tradeId) {
      if (!this.byTrade.has(order.tradeId)) {
        this.byTrade.set(order.tradeId, new Set())
      }
      this.byTrade.get(order.tradeId)!.add(order.id)
    }
  }

  /** Transition an order to a new state */
  transition(orderId: string, to: OTS): boolean {
    const entry = this.orders.get(orderId)
    if (!entry) return false

    const allowed = ORDER_TRACKER_TRANSITIONS[entry.state]
    if (!allowed.includes(to)) {
      return false
    }

    entry.state = to
    return true
  }

  /** Get current tracking state */
  getState(orderId: string): OTS | undefined {
    return this.orders.get(orderId)?.state
  }

  /** Get order object */
  get(orderId: string): Order | undefined {
    return this.orders.get(orderId)?.order
  }

  /** Update the underlying Order model */
  updateOrder(order: Order): void {
    const entry = this.orders.get(order.id)
    if (entry) {
      entry.order = order
    }
  }

  /** Get all orders in a given tracking state */
  getByState(...states: OTS[]): Order[] {
    const result: Order[] = []
    for (const entry of this.orders.values()) {
      if (states.length === 0 || states.includes(entry.state)) {
        result.push(entry.order)
      }
    }
    return result
  }

  /** Get orders for a specific trade */
  getByTrade(tradeId: string): Order[] {
    const ids = this.byTrade.get(tradeId)
    if (!ids) return []
    return Array.from(ids)
      .map(id => this.orders.get(id)?.order)
      .filter((o): o is Order => o !== undefined)
  }

  /** Get all tracked orders */
  getAll(): Order[] {
    return Array.from(this.orders.values()).map(e => e.order)
  }

  /** Remove an order from tracking (terminal cleanup) */
  remove(orderId: string): Order | undefined {
    const entry = this.orders.get(orderId)
    if (!entry) return undefined
    this.orders.delete(orderId)
    if (entry.order.tradeId) {
      this.byTrade.get(entry.order.tradeId)?.delete(orderId)
      if (this.byTrade.get(entry.order.tradeId)?.size === 0) {
        this.byTrade.delete(entry.order.tradeId)
      }
    }
    return entry.order
  }

  /** Count of active (non-terminal) orders */
  get activeCount(): number {
    let count = 0
    for (const entry of this.orders.values()) {
      if (entry.state !== OrderTrackerState.Completed && entry.state !== OrderTrackerState.Failed) {
        count++
      }
    }
    return count
  }

  /** All orders in non-terminal states */
  getActiveOrders(): Order[] {
    return this.getByState(OrderTrackerState.Active, OrderTrackerState.Working, OrderTrackerState.PendingCancel, OrderTrackerState.Replacing)
  }

  /** Snapshot all tracked data for persistence */
  snapshot(): Array<{ order: Order; state: OTS }> {
    return Array.from(this.orders.values())
  }

  /** Load tracked orders from snapshot */
  load(data: Array<{ order: Order; state: OTS }>): void {
    for (const item of data) {
      this.add(item.order)
      // Override state to what was saved
      this.orders.set(item.order.id, { order: item.order, state: item.state })
      // Re-add trade index
      if (item.order.tradeId) {
        if (!this.byTrade.has(item.order.tradeId)) {
          this.byTrade.set(item.order.tradeId, new Set())
        }
        this.byTrade.get(item.order.tradeId)!.add(item.order.id)
      }
    }
  }

  clear(): void {
    this.orders.clear()
    this.byTrade.clear()
  }
}
