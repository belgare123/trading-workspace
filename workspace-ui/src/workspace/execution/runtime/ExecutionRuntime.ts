// ── ExecutionRuntime — Facade for the Execution Simulator ──
//
// Orchestrates the full execution pipeline:
//   submitOrder → OrderBook → Accept → OrderMatcher → FillEngine
//     → PositionRuntime → TradeLedger → CashLedger → EquityLedger
//
// All state changes emit events through ExecutionEventBus.
//
// @since 3.5.1

import type {
  OrderRequest,
  Order,
  MarketSnapshot,
  ExecutionResult,
  ExecutionConfig,
  ExecutionOrderContext,
} from '../types'

import { OrderStatus } from '../types'
import { OrderBook } from '../orders/OrderBook'
import { PendingOrders } from '../orders/PendingOrders'
import { OrderMatcher } from '../orders/OrderMatcher'
import { FillEngine } from '../fills/FillEngine'
import { PositionRuntime } from '../positions/PositionRuntime'
import { TradeLedger } from '../ledger/TradeLedger'
import { CashLedger } from '../ledger/CashLedger'
import { EquityLedger } from '../ledger/EquityLedger'
import { ExecutionEventBus } from '../events/ExecutionEventBus'
import {
  acceptOrder,
  rejectOrder,
  fillOrder,
  cancelOrder,
  expireOrder,
  isActive,
} from '../orders/OrderLifecycle'

export class ExecutionRuntime {
  // ── Sub-runtimes ──
  readonly orderBook: OrderBook
  readonly pendingOrders: PendingOrders
  readonly orderMatcher: OrderMatcher
  fillEngine: FillEngine
  readonly positionRuntime: PositionRuntime
  readonly tradeLedger: TradeLedger
  readonly cashLedger: CashLedger
  readonly equityLedger: EquityLedger
  readonly events: ExecutionEventBus

  // ── Config ──
  private initialized = false
  private barCount = 0
  private fillCount = 0
  private initialCash = 0

  // ── Order ID counter ──
  private orderCounter = 0

  constructor() {
    this.orderBook = new OrderBook()
    this.pendingOrders = new PendingOrders()
    this.orderMatcher = new OrderMatcher()
    // Default models — replaced in initialize()
    this.fillEngine = new FillEngine(
      { calculate: () => 0 },
      { calculate: () => 0 },
      { determine: (o, _m, q) => [{ id: `fill-${o.id}`, orderId: o.id, symbol: o.symbol, side: o.side, quantity: q, price: o.averagePrice, commission: 0, commissionAsset: 'USDT', slippage: 0, timestamp: Date.now() }] },
    )
    this.positionRuntime = new PositionRuntime()
    this.tradeLedger = new TradeLedger()
    this.cashLedger = new CashLedger()
    this.equityLedger = new EquityLedger(0)
    this.events = new ExecutionEventBus()

    this.setupEventForwarding()
  }

  // ═══════════════════════════════════
  // Initialization
  // ═══════════════════════════════════

  initialize(config: ExecutionConfig): void {
    this.initialCash = config.initialCash
    // Re-initialize ledger instances (clear + seed initial state)
    this.cashLedger.clear()
    this.cashLedger.seed('USDT', config.initialCash)
    this.equityLedger.seed(config.initialCash)
    this.orderBook.clear()
    this.pendingOrders.clear()
    this.tradeLedger.clear()
    this.positionRuntime.clear()

    // Replace fill engine with configured models
    this.fillEngine = new FillEngine(config.slippageModel, config.commissionModel, {
      determine: (o, m, _q) => {
        const result = config.fillModel.execute(o, m)
        // Convert FillModel output to FillPolicy fills
        return result.fills
      },
    })

    this.initialized = true
    this.barCount = 0
    this.fillCount = 0
  }

  get isInitialized(): boolean {
    return this.initialized
  }

  // ═══════════════════════════════════
  // Order Submission (called by Strategy Runtime)
  // ═══════════════════════════════════

  /** Default strategy ID if none provided */
  private defaultStrategyId = 'execution-simulator'

  submitOrder(orderRequest: Partial<OrderRequest> & { symbol: string; side: 'buy' | 'sell'; quantity: number }): Order {
    const request: OrderRequest = {
      id: orderRequest.id ?? `order-${++this.orderCounter}-${Date.now()}`,
      strategyId: orderRequest.strategyId ?? this.defaultStrategyId,
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      type: orderRequest.type ?? 'market',
      quantity: orderRequest.quantity,
      price: orderRequest.price,
      stopPrice: orderRequest.stopPrice,
      reduceOnly: orderRequest.reduceOnly,
      timeInForce: orderRequest.timeInForce ?? 'GTC',
      clientId: orderRequest.clientId,
      timestamp: Date.now(),
    }

    // Add to order book
    const order = this.orderBook.add(request)
    this.events.emit({ type: 'ORDER_SUBMITTED', order, timestamp: Date.now() })

    // Validate and accept
    const validation = this.validate(request)
    if (!validation.valid) {
      const rejected = this.orderBook.update(request.id, o => rejectOrder(o, validation.reason!))
      this.events.emit({ type: 'ORDER_REJECTED', order: rejected, reason: validation.reason!, timestamp: Date.now() })
      return rejected
    }

    const accepted = this.orderBook.update(request.id, o => acceptOrder(o))
    this.events.emit({ type: 'ORDER_ACCEPTED', order: accepted, timestamp: Date.now() })

    this.pendingOrders.add(accepted)
    return accepted
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orderBook.get(orderId)
    if (!order || !isActive(order.status)) return false

    const cancelled = this.orderBook.update(orderId, o => cancelOrder(o))
    this.pendingOrders.remove(orderId)
    this.events.emit({ type: 'ORDER_CANCELLED', order: cancelled, timestamp: Date.now() })
    return true
  }

  getOrder(orderId: string): Order | undefined {
    return this.orderBook.get(orderId)
  }

  // ═══════════════════════════════════
  // Tick / Bar Processing
  // ═══════════════════════════════════

  /**
   * Process one bar: evaluate pending orders, execute fills, update state.
   * Called by backtest engine or paper trading loop.
   */
  onBar(market: MarketSnapshot): ExecutionResult {
    const startTime = Date.now()

    if (!this.initialized) {
      throw new Error('ExecutionRuntime not initialized. Call initialize() first.')
    }

    this.barCount++

    // 1. Check for expired orders
    this.processExpiredOrders()

    // 2. Evaluate pending orders against market
    const eligible = this.orderMatcher.evaluate(this.pendingOrders.all(), market)

    // 3. Process each triggered order
    let processedOrders = 0
    let filledOrders = 0
    let rejectedOrders = 0
    let totalFilledQuantity = 0
    let totalCommission = 0
    let totalSlippage = 0

    for (const order of eligible) {
      processedOrders++

      // Execute fill
      const { fills, remainingQty } = this.fillEngine.execute(order, market)

      if (fills.length === 0) continue

      let orderFilledQty = 0
      for (const fill of fills) {
        this.fillCount++
        totalFilledQuantity += fill.quantity
        totalCommission += fill.commission
        totalSlippage += fill.slippage

        // Update order with fill
        const updatedOrder = this.orderBook.update(order.id, o =>
          fillOrder(o, fill.quantity, fill.price, fill.commission),
        )
        orderFilledQty += fill.quantity

        // Emit fill event
        if (updatedOrder.status === OrderStatus.FILLED) {
          this.events.emit({ type: 'ORDER_FILLED', order: updatedOrder, fill, timestamp: Date.now() })
          filledOrders++
        } else {
          this.events.emit({
            type: 'ORDER_PARTIALLY_FILLED',
            order: updatedOrder,
            fill,
            remainingQuantity: remainingQty,
            timestamp: Date.now(),
          })
        }

        // Update position
        const prevPos = this.positionRuntime.getPosition(fill.symbol)
        const position = this.positionRuntime.applyFill(fill, updatedOrder)

        // Record trade and calculate realized PnL
        const realizedPnl = position.realizedPnl - (prevPos?.realizedPnl ?? 0)
        const trade = this.tradeLedger.record(fill, updatedOrder, realizedPnl)
        this.events.emit({ type: 'TRADE_RECORDED', trade, timestamp: Date.now() })

        // Process cash
        this.cashLedger.applyFill(fill)
      }

      // If completely filled, remove from pending
      const updatedOrder = this.orderBook.get(order.id)!
      if (updatedOrder.status === OrderStatus.FILLED) {
        this.pendingOrders.remove(order.id)
      } else {
        this.pendingOrders.update(updatedOrder)
      }
    }

    // 4. Mark-to-market positions
    const positions = this.positionRuntime.getPositions()
    for (const pos of positions) {
      const mtm = this.positionRuntime.markToMarket(pos.symbol, market.last)
      if (mtm) {
        this.events.emit({ type: 'POSITION_UPDATED', position: mtm, previousPosition: pos, timestamp: Date.now() })
      }
    }

    // 5. Equity snapshot
    const cash = this.cashLedger.total('USDT')
    const currentPositions = this.positionRuntime.getPositions()
    const prevEquity = this.equityLedger.latest()
    const equity = this.equityLedger.snapshot(cash, currentPositions)
    this.events.emit({ type: 'EQUITY_CHANGED', equity, previousEquity: prevEquity, timestamp: Date.now() })

    return {
      processedOrders,
      filledOrders,
      rejectedOrders,
      totalFilledQuantity,
      totalCommission,
      totalSlippage,
      positions: currentPositions,
      equity,
      duration: Date.now() - startTime,
    }
  }

  /** Convenience: submit+process in one tick (for paper trading) */
  submitAndExecute(
    orderRequest: Partial<OrderRequest> & { symbol: string; side: 'buy' | 'sell'; quantity: number },
    market: MarketSnapshot,
  ): ExecutionResult {
    this.submitOrder(orderRequest)
    return this.onBar(market)
  }

  // ═══════════════════════════════════
  // ExecutionOrderContext (bridge for Strategy Runtime)
  // ═══════════════════════════════════

  get orderContext(): ExecutionOrderContext {
    return {
      marketBuy: (symbol, quantity, strategyId?) => {
        const order = this.submitOrder({ symbol, side: 'buy', quantity: quantity, strategyId, type: 'market' })
        return Promise.resolve(order.id)
      },
      marketSell: (symbol, quantity, strategyId?) => {
        const order = this.submitOrder({ symbol, side: 'sell', quantity, strategyId, type: 'market' })
        return Promise.resolve(order.id)
      },
      limitBuy: (symbol, quantity, price, strategyId?) => {
        const order = this.submitOrder({ symbol, side: 'buy', quantity, price, strategyId, type: 'limit' })
        return Promise.resolve(order.id)
      },
      limitSell: (symbol, quantity, price, strategyId?) => {
        const order = this.submitOrder({ symbol, side: 'sell', quantity, price, strategyId, type: 'limit' })
        return Promise.resolve(order.id)
      },
      cancel: (orderId) => Promise.resolve(this.cancelOrder(orderId)),
      getOrder: (orderId) => this.orderBook.get(orderId),
      pendingOrders: () => this.orderBook.active(),
      allOrders: () => this.orderBook.all(),
    }
  }

  // ═══════════════════════════════════
  // Status
  // ═══════════════════════════════════

  getStatus() {
    const equity = this.equityLedger.latest()
    return {
      id: 'execution-simulator',
      running: this.initialized,
      barCount: this.barCount,
      orderCount: this.orderBook.size,
      fillCount: this.fillCount,
      positions: this.positionRuntime.getPositions().length,
      equity: equity?.totalEquity ?? this.initialCash,
      cash: equity?.cash ?? this.initialCash,
    }
  }

  reset(): void {
    this.initialized = false
    this.barCount = 0
    this.fillCount = 0
    this.orderCounter = 0
    this.orderBook.clear()
    this.pendingOrders.clear()
    this.positionRuntime.clear()
    this.tradeLedger.clear()
    this.equityLedger.clear()
    this.events.clear()
    this.cashLedger.clear()
  }

  // ═══════════════════════════════════
  // Private
  // ═══════════════════════════════════

  private setupEventForwarding(): void {
    this.positionRuntime.setEventCallback(({ type, position, previousPosition }) => {
      switch (type) {
        case 'OPENED':
          this.events.emit({ type: 'POSITION_OPENED', position, timestamp: Date.now() })
          break
        case 'UPDATED':
          this.events.emit({ type: 'POSITION_UPDATED', position, previousPosition, timestamp: Date.now() })
          break
        case 'CLOSED': {
          const pnl = position.realizedPnl - (previousPosition?.realizedPnl ?? 0)
          this.events.emit({ type: 'POSITION_CLOSED', position, realizedPnl: pnl, timestamp: Date.now() })
          break
        }
      }
    })
  }

  private validate(request: OrderRequest): { valid: boolean; reason?: string } {
    if (!request.symbol) return { valid: false, reason: 'Symbol is required' }
    if (request.quantity <= 0) return { valid: false, reason: 'Quantity must be positive' }
    if (request.type === 'limit' && (request.price == null || request.price <= 0)) {
      return { valid: false, reason: 'Limit orders require a positive price' }
    }
    if (request.type === 'stop' && (request.stopPrice == null || request.stopPrice <= 0)) {
      return { valid: false, reason: 'Stop orders require a positive stopPrice' }
    }
    return { valid: true }
  }

  private processExpiredOrders(): void {
    const now = Date.now()
    for (const order of this.pendingOrders.all()) {
      if (order.expiresAt != null && now >= order.expiresAt) {
        const expired = this.orderBook.update(order.id, o => expireOrder(o))
        this.pendingOrders.remove(order.id)
        this.events.emit({ type: 'ORDER_EXPIRED', order: expired, timestamp: Date.now() })
      }
    }
  }
}
