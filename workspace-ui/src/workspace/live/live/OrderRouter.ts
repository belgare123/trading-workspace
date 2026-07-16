/**
 * OrderRouter.ts — Order placement/routing through broker
 *
 * Routes orders to the broker via OrderAdapter, tracks ACK and status
 * transitions, and emits events into the platform's ExecutionEventBus.
 *
 * @since 4.5
 */

import type { BrokerAdapter, OrderAdapter } from './BrokerAdapter'
import type { BrokerOrder } from './types'
import type { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'
import type { Order, Fill, OrderStatus } from '../../execution/types'
import { classifyBrokerError } from './BrokerError'

export class OrderRouter {
  private adapter: OrderAdapter
  private eventBus?: ExecutionEventBus
  private pendingOrders = new Map<string, string>() // clientOrderId → brokerOrderId
  private brokerToLocal = new Map<string, string>() // brokerOrderId → clientOrderId
  private unsubscribers: Array<() => void> = []

  constructor(adapter: BrokerAdapter) {
    this.adapter = adapter.orders
  }

  /** Connect to event bus for forwarding broker events */
  connectEventBus(bus: ExecutionEventBus): void {
    this.eventBus = bus

    // Subscribe to broker order updates
    this.unsubscribers.push(
      this.adapter.subscribeOrders((brokerOrder) => {
        this.handleBrokerUpdate(brokerOrder)
      })
    )
  }

  /** Route an order to the broker */
  async route(order: Order): Promise<BrokerOrder> {
    try {
      const brokerOrder = await this.adapter.placeOrder({
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        type: this.mapOrderType(order.type),
        quantity: order.quantity,
        price: order.price,
        stopPrice: order.stopPrice,
        timeInForce: order.timeInForce,
        reduceOnly: order.reduceOnly,
        clientOrderId: order.id,
      })

      // Track the mapping
      this.pendingOrders.set(order.id, brokerOrder.brokerOrderId)
      this.brokerToLocal.set(brokerOrder.brokerOrderId, order.id)

      // Emit ORDER_ACCEPTED
      if (this.eventBus) {
        this.eventBus.emit({
          type: 'ORDER_ACCEPTED',
          order,
          timestamp: Date.now(),
        })
      }

      return brokerOrder
    } catch (err) {
      const brokerErr = classifyBrokerError(err)

      // Emit ORDER_REJECTED
      if (this.eventBus) {
        this.eventBus.emit({
          type: 'ORDER_REJECTED',
          order,
          reason: brokerErr.message,
          timestamp: Date.now(),
        })
      }
      throw brokerErr
    }
  }

  /** Cancel an order by client order ID */
  async cancel(clientOrderId: string): Promise<boolean> {
    const brokerId = this.pendingOrders.get(clientOrderId)
    if (!brokerId) return false

    try {
      return await this.adapter.cancelOrder(brokerId)
    } catch (err) {
      throw classifyBrokerError(err)
    }
  }

  /** Handle broker order update via subscription */
  private handleBrokerUpdate(update: BrokerOrder): void {
    const localId = this.brokerToLocal.get(update.brokerOrderId)
    if (!localId) return

    const order: Order = {
      id: localId,
      strategyId: '',
      symbol: update.symbol,
      side: update.side === 'buy' ? 'buy' : 'sell',
      type: update.type === 'MARKET' ? 'market' : update.type === 'LIMIT' ? 'limit' : 'stop',
      quantity: update.quantity,
      filledQuantity: update.filledQuantity,
      averagePrice: update.averagePrice,
      price: update.price,
      status: this.mapBrokerStatus(update.status) as OrderStatus,
      commission: update.commission,
      timeInForce: 'GTC',
      createdAt: update.createdAt,
      updatedAt: update.updatedAt,
    }

    if (!this.eventBus) return

    if (update.status === 'FILLED' || update.status === 'PARTIALLY_FILLED') {
      if (update.filledQuantity > 0) {
        const fill: Fill = {
          id: `fill_${update.updatedAt}`,
          orderId: localId,
          symbol: update.symbol,
          side: update.side === 'buy' ? 'buy' : 'sell',
          quantity: update.filledQuantity,
          price: update.averagePrice,
          commission: update.commission,
          commissionAsset: update.commissionAsset ?? '',
          slippage: 0,
          timestamp: update.updatedAt,
        }
        this.eventBus.emit({
          type: 'ORDER_FILLED',
          order,
          fill,
          timestamp: update.updatedAt,
        })
      }
    }

    if (update.status === 'CANCELLED' || update.status === 'EXPIRED') {
      this.eventBus.emit({
        type: 'ORDER_CANCELLED',
        order,
        timestamp: update.updatedAt,
      })
    }
  }

  /** Resolve local order ID from broker order ID */
  resolveLocal(brokerOrderId: string): string | undefined {
    return this.brokerToLocal.get(brokerOrderId)
  }

  /** Resolve broker order ID from local order ID */
  resolveBroker(localOrderId: string): string | undefined {
    return this.pendingOrders.get(localOrderId)
  }

  get pendingCount(): number {
    return this.pendingOrders.size
  }

  clear(): void {
    this.pendingOrders.clear()
    this.brokerToLocal.clear()
  }

  private mapOrderType(type: string): string {
    switch (type) {
      case 'market': return 'MARKET'
      case 'limit': return 'LIMIT'
      case 'stop': return 'STOP_LOSS'
      case 'stop_limit': return 'STOP_LOSS_LIMIT'
      default: return 'LIMIT'
    }
  }

  private mapBrokerStatus(brokerStatus: string): string {
    switch (brokerStatus) {
      case 'NEW': return 'pending'
      case 'PARTIALLY_FILLED': return 'partially_filled'
      case 'FILLED': return 'filled'
      case 'CANCELLED':
      case 'CANCELED': return 'cancelled'
      case 'EXPIRED': return 'expired'
      case 'REJECTED': return 'rejected'
      default: return 'pending'
    }
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers = []
    this.clear()
  }
}
