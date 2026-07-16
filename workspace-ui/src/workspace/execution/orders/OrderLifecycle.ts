// ── OrderLifecycle — Order state machine ──
//
// Pure functions for order state transitions.
// No side effects — emits no events, reads no external state.
//
// @since 3.5.1

import { OrderStatus } from '../types'
import type { Order, OrderRequest } from '../types'

export function createOrder(request: OrderRequest): Order {
  const now = request.timestamp ?? Date.now()
  return {
    id: request.id,
    strategyId: request.strategyId,
    symbol: request.symbol,
    side: request.side,
    type: request.type,
    quantity: request.quantity,
    filledQuantity: 0,
    averagePrice: 0,
    commission: 0,
    price: request.price,
    stopPrice: request.stopPrice,
    status: OrderStatus.PENDING,
    reduceOnly: request.reduceOnly ?? false,
    timeInForce: request.timeInForce ?? 'GTC',
    clientId: request.clientId,
    createdAt: now,
    updatedAt: now,
    expiresAt: request.timeInForce === 'DAY'
      ? endOfDay(now)
      : undefined,
  }
}

function endOfDay(timestamp: number): number {
  const d = new Date(timestamp)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

export function acceptOrder(order: Order): Order {
  return transition(order, OrderStatus.ACCEPTED)
}

export function rejectOrder(order: Order, reason: string): Order {
  return { ...transition(order, OrderStatus.REJECTED), rejectReason: reason }
}

export function fillOrder(order: Order, filledQty: number, fillPrice: number, _commission: number): Order {
  const newFilled = order.filledQuantity + filledQty
  const totalCost = order.averagePrice * order.filledQuantity + fillPrice * filledQty
  const newAvgPrice = totalCost / newFilled

  const isComplete = Math.abs(newFilled - order.quantity) < 1e-12
  const newStatus = isComplete ? OrderStatus.FILLED : OrderStatus.PARTIALLY_FILLED

  return {
    ...order,
    filledQuantity: newFilled,
    averagePrice: newAvgPrice,
    status: newStatus,
    updatedAt: Date.now(),
  }
}

export function cancelOrder(order: Order): Order {
  if (order.status === OrderStatus.FILLED || order.status === OrderStatus.CANCELLED) {
    throw new Error(`Cannot cancel order ${order.id} with status ${order.status}`)
  }
  return transition(order, OrderStatus.CANCELLED)
}

export function expireOrder(order: Order): Order {
  return transition(order, OrderStatus.EXPIRED)
}

/** Check if an order can still be modified/filled */
export function isActive(status: OrderStatus): boolean {
  return status === OrderStatus.ACCEPTED
    || status === OrderStatus.PARTIALLY_FILLED
    || status === OrderStatus.PENDING
}

/** Remaining unfilled quantity */
export function remainingQuantity(order: Order): number {
  return order.quantity - order.filledQuantity
}

function transition(order: Order, status: OrderStatus): Order {
  return { ...order, status, updatedAt: Date.now() }
}
