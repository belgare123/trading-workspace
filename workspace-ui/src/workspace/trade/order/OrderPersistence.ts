// ── OrderPersistence — snapshot/recovery for OrderManager ──

import { Order } from '../Order'
import { BrokerOrderStatus, OrderSide, OrderType, type Fill } from '../types'
import type { OrderTracker } from './OrderTracker'
import type { OrderTrackerState as OTS } from './types'

/** Serializable representation of tracked order */
export interface PersistedOrder {
  order: {
    id: string
    tradeId?: string
    symbol: string
    side: 'buy' | 'sell'
    type: string
    quantity: number
    price?: number
    stopPrice?: number
    timeInForce?: string
    reduceOnly?: boolean
    postOnly?: boolean
    clientOrderId?: string
    brokerOrderId?: string
    status: string
    filledQuantity: number
    averagePrice: number
    fills: Fill[]
    createdAt: number
    updatedAt: number
    lastError?: string
    retryCount: number
    maxRetries: number
  }
  state: OTS
}

export interface IPersistenceStore {
  save(key: string, data: unknown): Promise<void>
  load(key: string): Promise<unknown | undefined>
  remove(key: string): Promise<void>
}

/**
 * In-memory store (for testing/fallback).
 * In production, replace with file or DB store.
 */
export class InMemoryStore implements IPersistenceStore {
  private store = new Map<string, unknown>()

  async save(key: string, data: unknown): Promise<void> {
    this.store.set(key, data)
  }

  async load(key: string): Promise<unknown | undefined> {
    return this.store.get(key)
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key)
  }
}

export class OrderPersistence {
  private store: IPersistenceStore
  private tracker: OrderTracker

  constructor(store: IPersistenceStore, tracker: OrderTracker) {
    this.store = store
    this.tracker = tracker
  }

  /** Save current tracked orders to persistent store */
  async snapshot(): Promise<void> {
    const data = this.tracker.snapshot()
    const persisted: PersistedOrder[] = data.map(item => ({
      order: this.serializeOrder(item.order),
      state: item.state,
    }))
    await this.store.save('order-manager-active', persisted)
  }

  /** Load persisted orders into tracker */
  async recover(): Promise<number> {
    const raw = await this.store.load('order-manager-active')
    if (!raw || !Array.isArray(raw)) return 0

    const persisted = raw as PersistedOrder[]
    const orders = persisted.map(p => ({
      order: this.deserializeOrder(p.order),
      state: p.state,
    }))

    this.tracker.load(orders)
    await this.store.remove('order-manager-active')
    return orders.length
  }

  private serializeOrder(order: Order): PersistedOrder['order'] {
    return {
      id: order.id,
      tradeId: order.tradeId,
      symbol: order.symbol,
      side: order.side as 'buy' | 'sell',
      type: order.type,
      quantity: order.quantity,
      price: order.price,
      stopPrice: order.stopPrice,
      timeInForce: order.timeInForce,
      reduceOnly: order.reduceOnly,
      postOnly: order.postOnly,
      clientOrderId: order.clientOrderId,
      brokerOrderId: order.brokerOrderId,
      status: order.status,
      filledQuantity: order.filledQuantity ?? 0,
      averagePrice: order.averagePrice ?? 0,
      fills: order.fills ?? [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      lastError: order.lastError,
      retryCount: order.retryCount ?? 0,
      maxRetries: order.maxRetries ?? 0,
    }
  }

  private deserializeOrder(data: PersistedOrder['order']): Order {
    const order = new Order({
      id: data.id,
      tradeId: data.tradeId,
      symbol: data.symbol,
      side: data.side as any,
      type: data.type as any,
      quantity: data.quantity,
      price: data.price,
      stopPrice: data.stopPrice,
      timeInForce: data.timeInForce as any,
      reduceOnly: data.reduceOnly,
      postOnly: data.postOnly,
      clientOrderId: data.clientOrderId,
      brokerOrderId: data.brokerOrderId,
      status: data.status as any,
      fills: data.fills,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    })
    return order
  }
}
