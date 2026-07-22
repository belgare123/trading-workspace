// ── OrderManager — фасад Runtime исполнения ордеров ──

import { Order, type OrderId } from '../Order'
import { BrokerOrderStatus, type Fill } from '../types'
import {
  OrderEventType,
  type IOrderManager,
  type PlaceOrderRequest,
  type OrderEventHandler,
} from '../runtime/interfaces'
import { OrderTracker } from './OrderTracker'
import { OrderEventBus } from './events/OrderEventBus'
import { FillAggregator } from './FillAggregator'
import { RetryEngine } from './RetryEngine'
import { TimeoutManager } from './TimeoutManager'
import { ReplaceManager, type IReplaceGateway } from './ReplaceManager'
import { OrderReconciler, type IReconcileGateway } from './OrderReconciler'
import { OrderPersistence, type IPersistenceStore, InMemoryStore } from './OrderPersistence'
import { OrderTrackerState } from './types'

export interface OrderManagerConfig {
  gateway: IReplaceGateway & IReconcileGateway
  persistenceStore?: IPersistenceStore
  debug?: boolean
}

export class OrderManager implements IOrderManager {
  readonly eventBus = new OrderEventBus()

  readonly tracker = new OrderTracker()
  readonly fillAggregator = new FillAggregator()
  readonly retryEngine = new RetryEngine({ debug: true })
  readonly timeoutManager = new TimeoutManager()
  readonly replaceManager: ReplaceManager
  readonly reconciler: OrderReconciler
  readonly persistence: OrderPersistence

  private gateway: IReplaceGateway & IReconcileGateway
  private shutdownFlag = false
  private orderIdCounter = 0

  constructor(config: OrderManagerConfig) {
    this.gateway = config.gateway
    this.replaceManager = new ReplaceManager(config.gateway)
    this.reconciler = new OrderReconciler(config.gateway, this.tracker)
    this.persistence = new OrderPersistence(
      config.persistenceStore ?? new InMemoryStore(),
      this.tracker,
    )
  }

  // ══════════════════════════════════════
  // Core API
  // ══════════════════════════════════════

  async create(request: PlaceOrderRequest): Promise<Order> {
    this.assertNotShutdown()
    this.orderIdCounter++

    const order = new Order({
      id: request.clientOrderId ?? `ord_${request.tradeId}_${this.orderIdCounter}_${Date.now()}`,
      tradeId: request.tradeId,
      symbol: request.symbol,
      side: request.side as any,
      type: request.type as any,
      quantity: request.quantity,
      price: request.price,
      stopPrice: request.stopPrice,
      timeInForce: request.timeInForce as any,
      reduceOnly: request.reduceOnly,
      status: BrokerOrderStatus.New,
      fills: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Add to tracker
    this.tracker.add(order)
    this.emit(OrderEventType.OrderCreated, order)

    // Transition to Submitted before sending to gateway
    try { order.transitionTo(BrokerOrderStatus.Submitted) } catch { /* already past Submitted */ }
    this.tracker.transition(order.id, OrderTrackerState.Working)

    // Send to exchange with retry
    try {
      const { result: brokerOrder } = await this.retryEngine.execute(
        `create:${order.id}`,
        async (attempt) => {
          const result = await this.gateway.placeOrder({
            tradeId: request.tradeId,
            symbol: request.symbol,
            side: request.side,
            type: request.type,
            quantity: request.quantity,
            price: request.price,
            stopPrice: request.stopPrice,
            reduceOnly: request.reduceOnly,
            timeInForce: request.timeInForce,
            clientOrderId: order.id,
          })
          return result
        },
      )

      // Update order with broker ID
      if (brokerOrder && (brokerOrder as any).id) {
        order.brokerOrderId = (brokerOrder as any).id
      }

      // FSM: Submitted → Accepted → Working (best-effort, some transitions may be invalid)
      try { order.transitionTo(BrokerOrderStatus.Accepted) } catch { console.warn('[OrderManager] transition Accepted skipped for', order.id) }
      try { order.transitionTo(BrokerOrderStatus.Working) } catch { console.warn('[OrderManager] transition Working skipped for', order.id) }

      this.emit(OrderEventType.OrderAccepted, order)
      this.emit(OrderEventType.OrderWorking, order)

      // Start SLA timer
      this.timeoutManager.startOrder(order.id, order.type, (action) => {
        this.handleTimeout(action)
      })

    } catch (err) {
      this.handleOrderFailed(order, String(err))
    }

    return order
  }

  async cancel(orderId: string): Promise<void> {
    this.assertNotShutdown()

    const order = this.tracker.get(orderId)
    if (!order) throw new Error(`Order not found: ${orderId}`)

    if (!this.tracker.transition(orderId, OrderTrackerState.PendingCancel)) {
      // Terminal order, can't cancel
      return
    }

    try {
      await this.retryEngine.execute(
        `cancel:${orderId}`,
        async () => {
          await this.gateway.cancelOrder(orderId)
          return true
        },
      )
    } catch (err) {
      // Cancel may fail if order already filled — treat as resolved
      console.warn('[OrderManager] cancel broker call failed for', orderId, err)
    }

    // FSM transition
    try { order.transitionTo(BrokerOrderStatus.Cancelled) } catch { console.warn('[OrderManager] transition Cancelled skipped for', orderId) }

    // Finalize order
    this.tracker.transition(orderId, OrderTrackerState.Completed)
    this.timeoutManager.cancelOrder(orderId)
    this.emit(OrderEventType.OrderCancelled, order)
  }

  async replace(orderId: string, newParams: Partial<PlaceOrderRequest>): Promise<Order> {
    this.assertNotShutdown()

    const existingOrder = this.tracker.get(orderId)
    if (!existingOrder) throw new Error(`Order not found: ${orderId}`)

    this.tracker.transition(orderId, OrderTrackerState.Replacing)

    const { newOrder } = await this.replaceManager.replace(existingOrder, newParams)

    // Track the new order
    this.tracker.add(newOrder)
    this.tracker.transition(newOrder.id, OrderTrackerState.Working)
    this.emit(OrderEventType.OrderCreated, newOrder)

    // Mark old order as completed
    this.tracker.transition(orderId, OrderTrackerState.Completed)
    this.emit(OrderEventType.OrderReplaced, existingOrder)

    // FSM for new order
    try { newOrder.transitionTo(BrokerOrderStatus.Accepted) } catch { console.warn('[OrderManager] replace transition Accepted skipped for', newOrder.id) }
    try { newOrder.transitionTo(BrokerOrderStatus.Working) } catch { console.warn('[OrderManager] replace transition Working skipped for', newOrder.id) }
    this.emit(OrderEventType.OrderAccepted, newOrder)

    // Start SLA timer for new order
    this.timeoutManager.startOrder(newOrder.id, newOrder.type, (action) => {
      this.handleTimeout(action)
    })

    return newOrder
  }

  async amend(orderId: string, newParams: Partial<PlaceOrderRequest>): Promise<Order> {
    return this.replace(orderId, newParams)
  }

  get(orderId: string): Order | undefined {
    return this.tracker.get(orderId)
  }

  list(tradeId?: string): Order[] {
    if (tradeId) return this.tracker.getByTrade(tradeId)
    return this.tracker.getAll()
  }

  async recover(): Promise<void> {
    const count = await this.persistence.recover()
    // Recovered orders need to be reconciled
    if (count > 0) {
      const activeOrders = this.tracker.getActiveOrders()
      for (const order of activeOrders) {
        this.timeoutManager.startOrder(order.id, order.type, (action) => {
          this.handleTimeout(action)
        })
      }
      await this.reconciler.reconcile()
    }
  }

  shutdown(): void {
    this.shutdownFlag = true
    this.timeoutManager.clear()
    this.retryEngine.reset()
    this.eventBus.removeAll()
  }

  // ══════════════════════════════════════
  // Event Bus API
  // ══════════════════════════════════════

  on(eventType: OrderEventType | '*', handler: OrderEventHandler): () => void {
    return this.eventBus.on(eventType, handler)
  }

  off(eventType: OrderEventType | '*', handler: OrderEventHandler): void {
    this.eventBus.off(eventType, handler)
  }

  // ══════════════════════════════════════
  // Fill ingestion (called by Gateway adapter)
  // ══════════════════════════════════════

  /**
   * Called by Gateway or external adapter when a fill arrives.
   * FSM-safe: delegates to Order.addFill for internal tracking,
   * and FillAggregator for VWAP computation.
   */
  handleFill(orderId: string, fill: Fill): void {
    const order = this.tracker.get(orderId)
    if (!order) return

    // Update FillAggregator (order-level VWAP tracking)
    const agg = this.fillAggregator.addFill(orderId, fill)

    // Update Order model via addFill (validates FSM, tracks internal fills)
    try { order.addFill(fill) } catch {
      // If already past PartialFill, just record fill data
      order.touch()
    }

    this.tracker.updateOrder(order)

    // Emit partial fill event
    this.emit(OrderEventType.OrderPartial, order, fill)

    // If fully filled (check via Order's own status)
    if (order.status === BrokerOrderStatus.Filled) {
      this.handleOrderFilled(order, fill, agg.price)
    }
  }

  // ══════════════════════════════════════
  // Internal event handling
  // ══════════════════════════════════════

  /**
   * Called by Gateway or external adapter when an order is accepted.
   */
  handleOrderAccepted(order: Order): void {
    // Try FSM transitions (may already be past Submitted via create)
    try { order.transitionTo(BrokerOrderStatus.Accepted) } catch { console.warn('[OrderManager] handleOrderAccepted transition Accepted skipped for', order.id) }
    try { order.transitionTo(BrokerOrderStatus.Working) } catch { console.warn('[OrderManager] handleOrderAccepted transition Working skipped for', order.id) }

    order.touch()
    this.tracker.updateOrder(order)
    this.tracker.transition(order.id, OrderTrackerState.Working)
    this.emit(OrderEventType.OrderWorking, order)
  }

  /**
   * Called when order is fully filled.
   */
  handleOrderFilled(order: Order, fill: Fill, vwapPrice?: number): void {
    // Status is already set to Filled by order.addFill
    this.tracker.updateOrder(order)
    this.tracker.transition(order.id, OrderTrackerState.Completed)
    this.timeoutManager.cancelOrder(order.id)
    this.fillAggregator.finalize(order.id)
    this.emit(OrderEventType.OrderFilled, order, fill)
  }

  /**
   * Handle order failure (rejection / retry exhaustion)
   */
  handleOrderFailed(order: Order, reason: string): void {
    // Check if already filled (race)
    if (order.status === BrokerOrderStatus.Filled) {
      this.handleOrderFilled(order, { price: order.averagePrice!, quantity: order.filledQuantity } as Fill)
      return
    }

    // FSM: try Rejected
    try { order.transitionTo(BrokerOrderStatus.Rejected) } catch {
      // If transition fails (e.g. already in terminal), just mark
    }

    order.lastError = reason
    order.touch()
    this.tracker.updateOrder(order)
    this.tracker.transition(order.id, OrderTrackerState.Failed)
    this.timeoutManager.cancelOrder(order.id)
    this.emit(OrderEventType.OrderRejected, order, reason)
  }

  /**
   * Handle SLA timeout
   */
  private handleTimeout(action: { orderId: string; action: string }): void {
    const order = this.tracker.get(action.orderId)
    if (!order) return

    switch (action.action) {
      case 'cancel':
        this.cancel(action.orderId).catch(() => {})
        break
      case 'replace':
        this.replace(action.orderId, {}).catch(() => {})
        break
      case 'alert':
        console.warn(`[OrderManager] SLA alert: ${action.orderId} (${order.type})`)
        break
    }
  }

  // ══════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════

  private emit(type: 'OrderCreated', order: Order): void
  private emit(type: 'OrderAccepted', order: Order): void
  private emit(type: 'OrderWorking', order: Order): void
  private emit(type: 'OrderPartial', order: Order, fill: Fill): void
  private emit(type: 'OrderFilled', order: Order, fill: Fill): void
  private emit(type: 'OrderCancelled', order: Order): void
  private emit(type: 'OrderRejected', order: Order, reason: string): void
  private emit(type: 'OrderExpired', order: Order): void
  private emit(type: 'OrderReplaced', order: Order, replacedBy?: string): void
  private emit(eventType: any, order: Order, extra?: any): void {
    this.eventBus.emit({
      type: eventType,
      order,
      timestamp: Date.now(),
      ...(extra !== undefined ? (typeof extra === 'string' ? { reason: extra } : { fill: extra }) : {}),
    } as any)
  }

  private assertNotShutdown(): void {
    if (this.shutdownFlag) {
      throw new Error('OrderManager is shut down')
    }
  }
}
