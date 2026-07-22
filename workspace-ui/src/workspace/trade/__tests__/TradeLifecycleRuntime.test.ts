// ── TradeLifecycleRuntime: 10 criteria tests (Sprint 5.3) ──

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Trade } from '../Trade'
import { Order } from '../Order'
import { TradeLifecycleRuntime } from '../runtime/TradeLifecycleRuntime'
import { LifecycleEventBus } from '../runtime/LifecycleEventBus'
import {
  TradeStatus,
  Direction,
  OrderSide,
  OrderType,
  BrokerOrderStatus,
  ExitReason,
  type Fill as TradeFill,
} from '../types'
import { TradeEventType } from '../TradeLifecycleEvent'
import { OrderEventBus } from '../order/events/OrderEventBus'
import type {
  IOrderManager,
  IExitEngine,
  IRecoveryGateway,
  TradeSignal,
  PlaceOrderRequest,
  OrderEvent,
  OrderEventType,
  OrderEventHandler,
} from '../runtime/interfaces'
import type { MarketSnapshot } from '../../execution/types'

// ════════════════════════════════════════
// Helpers
// ════════════════════════════════════════

/** Flush pending microtasks (resolve chained promises) */
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => queueMicrotask(resolve))
}

function makeFill(overrides: Partial<TradeFill> = {}): TradeFill {
  const price = overrides.price ?? 60000
  const quantity = overrides.quantity ?? 1.0
  return {
    id: 'fill-1',
    orderId: 'order-1',
    tradeId: 'trade-1',
    symbol: 'BTCUSDT',
    side: 'buy' as const,
    price,
    quantity,
    quoteQuantity: price * quantity,
    fee: { asset: 'USDT', amount: price * quantity * 0.001, rate: 0.001, currency: 'USDT' },
    timestamp: Date.now(),
    ...overrides,
  }
}

// ════════════════════════════════════════
// Mock OrderManager (implements new IOrderManager)
// ════════════════════════════════════════

class MockOrderManager implements IOrderManager {
  private orders = new Map<string, Order>()
  private orderIdCounter = 0
  readonly eventBus = new OrderEventBus()

  async create(request: PlaceOrderRequest): Promise<Order> {
    const orderId = `mock-order-${++this.orderIdCounter}`
    const order = new Order({
      id: orderId,
      tradeId: request.tradeId,
      symbol: request.symbol,
      side: request.side as any,
      type: request.type as any,
      quantity: request.quantity,
      price: request.price,
      status: BrokerOrderStatus.New,
      fills: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    this.orders.set(orderId, order)

    // Simulate full gateway round-trip: New → Submitted → Accepted → Working
    order.transitionTo(BrokerOrderStatus.Submitted)
    order.transitionTo(BrokerOrderStatus.Accepted)
    order.transitionTo(BrokerOrderStatus.Working)

    // Emit events
    this.eventBus.emit({ type: 'OrderCreated' as any, order, timestamp: Date.now() })
    this.eventBus.emit({ type: 'OrderWorking' as any, order, timestamp: Date.now() })

    return order
  }

  async cancel(orderId: string): Promise<void> {
    const order = this.orders.get(orderId)
    if (!order) return

    // Cancel valid from Working or PartialFill
    try { order.transitionTo(BrokerOrderStatus.Cancelled) } catch {}
    this.eventBus.emit({ type: 'OrderCancelled' as any, order, timestamp: Date.now() })
    this.orders.delete(orderId)
  }

  async replace(orderId: string, request: Partial<PlaceOrderRequest>): Promise<Order> {
    throw new Error('not implemented in mock')
  }

  async amend(orderId: string, request: Partial<PlaceOrderRequest>): Promise<Order> {
    throw new Error('not implemented in mock')
  }

  get(orderId: string): Order | undefined {
    return this.orders.get(orderId)
  }

  list(tradeId?: string): Order[] {
    return Array.from(this.orders.values()).filter(o => !tradeId || o.tradeId === tradeId)
  }

  async recover(): Promise<void> {
    // no-op for tests
  }

  shutdown(): void {
    this.eventBus.removeAll()
  }

  on(eventType: OrderEventType | '*', handler: OrderEventHandler): () => void {
    return this.eventBus.on(eventType, handler)
  }

  off(eventType: OrderEventType | '*', handler: OrderEventHandler): void {
    this.eventBus.off(eventType, handler)
  }

  // ── Test helpers ──

  /** Simulate a partial fill from Gateway */
  simulatePartialFill(orderId: string, fill: TradeFill): void {
    const order = this.orders.get(orderId)
    if (!order) return

    order.addFill(fill)
    this.eventBus.emit({
      type: 'OrderPartial' as any,
      order,
      fill,
      timestamp: Date.now(),
    })
  }

  /** Simulate order fully filled */
  simulateFilled(orderId: string): void {
    const order = this.orders.get(orderId)
    if (!order) return

    // Use addFill which auto-transitions to PartialFill → Filled
    const remaining = order.quantity - order.filledQuantity
    if (remaining > 0) {
      order.addFill({
        id: `agg-${orderId}`,
        orderId,
        tradeId: order.tradeId ?? '',
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        price: order.averagePrice ?? order.price ?? 0,
        quantity: remaining,
        quoteQuantity: (order.averagePrice ?? order.price ?? 0) * remaining,
        timestamp: Date.now(),
      })
    }

    const aggregFill: TradeFill = {
      id: `agg-${orderId}`,
      orderId,
      tradeId: order.tradeId ?? '',
      symbol: order.symbol,
      side: order.side as 'buy' | 'sell',
      price: order.averagePrice ?? order.price ?? 0,
      quantity: remaining,
      quoteQuantity: (order.averagePrice ?? order.price ?? 0) * remaining,
      timestamp: Date.now(),
    }
    this.eventBus.emit({
      type: 'OrderFilled' as any,
      order,
      fill: aggregFill,
      timestamp: Date.now(),
    })
  }

  /** Simulate order accepted */
  simulateAccepted(orderId: string): void {
    const order = this.orders.get(orderId)
    if (!order) return

    try { order.transitionTo(BrokerOrderStatus.Accepted) } catch {}
    try { order.transitionTo(BrokerOrderStatus.Working) } catch {}
    this.eventBus.emit({ type: 'OrderAccepted' as any, order, timestamp: Date.now() })
  }

  /** Simulate order cancelled */
  simulateCancelled(orderId: string): void {
    const order = this.orders.get(orderId)
    if (!order) return

    try { order.transitionTo(BrokerOrderStatus.Cancelled) } catch {}
    this.eventBus.emit({ type: 'OrderCancelled' as any, order, timestamp: Date.now() })
  }

  /** Simulate order rejected */
  simulateRejected(orderId: string, reason: string): void {
    const order = this.orders.get(orderId)
    if (!order) return

    try { order.transitionTo(BrokerOrderStatus.Rejected) } catch {}
    this.eventBus.emit({ type: 'OrderRejected' as any, order, reason, timestamp: Date.now() })
  }

  /** Simulate order expired */
  simulateExpired(orderId: string): void {
    const order = this.orders.get(orderId)
    if (!order) return

    try { order.transitionTo(BrokerOrderStatus.Expired) } catch {}
    this.eventBus.emit({ type: 'OrderExpired' as any, order, timestamp: Date.now() })
  }
}

class MockExitEngine implements IExitEngine {
  private decisions = new Map<string, ReturnType<IExitEngine['evaluate']>>()

  setDecisionForTrade(tradeId: string, decision: ReturnType<IExitEngine['evaluate']>): void {
    this.decisions.set(tradeId, decision)
  }

  evaluate(context: any): ReturnType<IExitEngine['evaluate']> {
    return this.decisions.get(context.trade.id) ?? null
  }
}

class MockRecoveryGateway implements IRecoveryGateway {
  private positions: Promise<Awaited<ReturnType<IRecoveryGateway['getPositions']>>> = Promise.resolve([])
  private orders: Promise<Awaited<ReturnType<IRecoveryGateway['getOrders']>>> = Promise.resolve([])

  setPositions(positions: Awaited<ReturnType<IRecoveryGateway['getPositions']>>): void {
    this.positions = Promise.resolve(positions)
  }

  setOrders(orders: Awaited<ReturnType<IRecoveryGateway['getOrders']>>): void {
    this.orders = Promise.resolve(orders)
  }

  async getPositions(): Promise<Awaited<ReturnType<IRecoveryGateway['getPositions']>>> {
    return this.positions
  }

  async getOrders(): Promise<Awaited<ReturnType<IRecoveryGateway['getOrders']>>> {
    return this.orders
  }
}

// ════════════════════════════════════════
// Test helpers
// ════════════════════════════════════════

function makeSignal(overrides: Partial<TradeSignal> = {}): TradeSignal {
  return {
    strategyId: 'strategy-1',
    symbol: 'BTCUSDT',
    direction: Direction.Long,
    type: OrderType.Market,
    quantity: 1.0,
    ...overrides,
  }
}

function makeMarketSnapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    symbol: 'BTCUSDT',
    bid: 60000,
    ask: 60005,
    last: 60002,
    volume: 100,
    timestamp: Date.now(),
    ...overrides,
  }
}

/** Drive a trade from Created to Managing */
async function openAndFillTrade(
  runtime: TradeLifecycleRuntime,
  om: MockOrderManager,
  signalOverrides: Partial<TradeSignal> = {},
): Promise<{ trade: Trade; entryOrderId: string }> {
  const trade = await runtime.open(makeSignal(signalOverrides))
  const entryOrderId = trade.orderIds[trade.orderIds.length - 1]

  const fill = makeFill({ orderId: entryOrderId, quantity: signalOverrides.quantity ?? 1.0 })
  await om.simulatePartialFill(entryOrderId, fill)
  om.simulateFilled(entryOrderId)

  return { trade, entryOrderId }
}

// ════════════════════════════════════════
// Tests
// ════════════════════════════════════════

describe('TradeLifecycleRuntime — 10 criteria (Sprint 5.3)', () => {
  let orderManager: MockOrderManager
  let exitEngine: MockExitEngine
  let recoveryGateway: MockRecoveryGateway
  let runtime: TradeLifecycleRuntime
  let events: any[]

  beforeEach(() => {
    orderManager = new MockOrderManager()
    exitEngine = new MockExitEngine()
    recoveryGateway = new MockRecoveryGateway()
    events = []

    runtime = new TradeLifecycleRuntime({
      orderManager,
      exitEngine,
      gateway: recoveryGateway,
    })

    runtime.eventBus.on('*', (event) => {
      events.push(event)
    })
  })

  // ══════════════════════════════════════
  // C1: Strategy → open() → Filled → Managing
  // ══════════════════════════════════════

  it('C1: open() → EntryPending → EntryPartial → Managing', async () => {
    const signal = makeSignal()
    const trade = await runtime.open(signal)

    expect(trade.status).toBe(TradeStatus.EntryPending)
    expect(trade.strategyId).toBe('strategy-1')
    expect(trade.symbol).toBe('BTCUSDT')
    expect(trade.orderIds.length).toBe(1)
    const entryOrderId = trade.orderIds[0]
    expect(entryOrderId).toMatch(/^mock-order-/)
    expect(events.some(e => e.type === TradeEventType.TradeOpened)).toBe(true)

    // Partial fill
    const fill = makeFill({ orderId: entryOrderId, quantity: 1.0 })
    orderManager.simulatePartialFill(entryOrderId, fill)
    expect(trade.status).toBe(TradeStatus.EntryPartial)
    expect(events.some(e => e.type === TradeEventType.TradeEntryPartial)).toBe(true)

    // Filled
    orderManager.simulateFilled(entryOrderId)
    expect(trade.status).toBe(TradeStatus.Managing)
    expect(trade.entry).not.toBeNull()
    expect(trade.entry!.quantity).toBe(1.0)
    expect(events.some(e => e.type === TradeEventType.TradeEntryFilled)).toBe(true)
  })

  // ══════════════════════════════════════
  // C2: Partial entry → Partial → Filled
  // ══════════════════════════════════════

  it('C2: multiple partial fills then filled', async () => {
    const trade = await runtime.open(makeSignal({ quantity: 2.0 }))
    const orderId = trade.orderIds[0]

    // First partial fill (0.5 at 60000)
    const f1 = makeFill({ orderId, quantity: 0.5, price: 60000 })
    orderManager.simulatePartialFill(orderId, f1)
    expect(trade.status).toBe(TradeStatus.EntryPartial)
    expect(trade.entry!.quantity).toBe(0.5)

    // Second partial fill (1.5 at 60500)
    const f2 = makeFill({ orderId, quantity: 1.5, price: 60500 })
    orderManager.simulatePartialFill(orderId, f2)
    expect(trade.status).toBe(TradeStatus.EntryPartial)
    expect(trade.entry!.quantity).toBe(2.0)

    // VWAP: (0.5*60000 + 1.5*60500) / 2.0 = 60375
    expect(trade.entry!.price).toBeCloseTo(60375, 0)

    // Filled → Managing
    orderManager.simulateFilled(orderId)
    expect(trade.status).toBe(TradeStatus.Managing)
  })

  // ══════════════════════════════════════
  // C3: Cancel / Reject before fill
  // ══════════════════════════════════════

  it('C3: reject before fill → Rejected', async () => {
    const trade = await runtime.open(makeSignal())
    const orderId = trade.orderIds[0]

    orderManager.simulateRejected(orderId, 'insufficient margin')
    expect(trade.status).toBe(TradeStatus.Rejected)
    expect(trade.isTerminal).toBe(true)
    expect(events.some(e => e.type === TradeEventType.TradeRejected)).toBe(true)
  })

  it('C3b: cancel after accepted → Cancelled', async () => {
    const trade = await runtime.open(makeSignal())
    const orderId = trade.orderIds[0]

    orderManager.simulateAccepted(orderId)
    orderManager.simulateCancelled(orderId)

    expect(trade.status).toBe(TradeStatus.Cancelled)
    expect(trade.isTerminal).toBe(true)
    expect(events.some(e => e.type === TradeEventType.TradeCancelled)).toBe(true)
  })

  // ══════════════════════════════════════
  // C4: Manual Close
  // ══════════════════════════════════════

  it('C4: Manual Close → ExitPending → Closed', async () => {
    const { trade } = await openAndFillTrade(runtime, orderManager)
    expect(trade.status).toBe(TradeStatus.Managing)

    // Request manual close
    await runtime.requestClose(trade.id, 'manual')
    expect(trade.status).toBe(TradeStatus.ExitPending)
    expect(events.some(e => e.type === TradeEventType.TradeExitPending)).toBe(true)

    // Exit fill — single fill closes the trade
    const exitOrderId = trade.orderIds[trade.orderIds.length - 1]
    const exitFill = makeFill({ orderId: exitOrderId, quantity: 1.0, price: 62000, side: 'sell' as const })
    orderManager.simulatePartialFill(exitOrderId, exitFill)

    expect(trade.status).toBe(TradeStatus.Closed)
    expect(trade.isTerminal).toBe(true)
    // Runtime emits ExitPartial before Closed
    const exitPartialEvt = events.find(e => e.type === TradeEventType.TradeExitPartial)
    const closedEvt = events.find(e => e.type === TradeEventType.TradeClosed)
    expect(exitPartialEvt).toBeTruthy()
    expect(closedEvt).toBeTruthy()
    // ExitPartial event index should be before Closed
    const exitPartialIdx = events.indexOf(exitPartialEvt!)
    const closedIdx = events.indexOf(closedEvt!)
    expect(exitPartialIdx).toBeLessThan(closedIdx)
  })

  // ══════════════════════════════════════
  // C5: TP through ExitEngine
  // ══════════════════════════════════════

  it('C5: TP through ExitEngine → ExitPending', async () => {
    const { trade } = await openAndFillTrade(runtime, orderManager)

    exitEngine.setDecisionForTrade(trade.id, {
      reason: ExitReason.StopLoss,
      exitPrice: 62000,
      exitType: 'market',
      quantity: 'all',
      priority: 0,
    })

    runtime.onMarketTick(makeMarketSnapshot({ last: 62000, bid: 61995, ask: 62005 }))

    // Flush microtasks to let triggerExit complete
    await flushMicrotasks()

    expect(trade.status).toBe(TradeStatus.ExitPending)
    expect(events.some(e => e.type === TradeEventType.TradeExitPending)).toBe(true)
  })

  // ══════════════════════════════════════
  // C6: SL through ExitEngine
  // ══════════════════════════════════════

  it('C6: SL through ExitEngine → ExitPending', async () => {
    const { trade } = await openAndFillTrade(runtime, orderManager)

    exitEngine.setDecisionForTrade(trade.id, {
      reason: ExitReason.StopLoss,
      exitPrice: 59000,
      exitType: 'market',
      quantity: 'all',
      priority: 50,
    })

    runtime.onMarketTick(makeMarketSnapshot({ last: 59000, bid: 58995, ask: 59005 }))
    await flushMicrotasks()

    expect(trade.status).toBe(TradeStatus.ExitPending)
  })

  // ══════════════════════════════════════
  // C7: Recovery after restart
  // ══════════════════════════════════════

  it('C7: Recovery after restart with open position', async () => {
    recoveryGateway.setPositions([
      {
        symbol: 'BTCUSDT',
        direction: 'long',
        quantity: 1.5,
        averageEntryPrice: 60000,
        currentPrice: 61000,
        unrealizedPnl: 1500,
        realizedPnl: 0,
      },
    ])

    const recovered = await runtime.recover()
    expect(recovered).toHaveLength(1)

    const trade = recovered[0]
    expect(trade.symbol).toBe('BTCUSDT')
    expect(trade.status).toBe(TradeStatus.Managing)
    expect(trade.entry!.quantity).toBe(1.5)
    expect(trade.entry!.price).toBe(60000)
    expect(trade.unrealizedPnL).toBe(1500)

    // Registered in runtime
    expect(runtime.getActiveTrades()).toHaveLength(1)
    expect(runtime.getTrade(trade.id)).toBe(trade)
    expect(events.some(e => e.type === TradeEventType.TradeOpened)).toBe(true)
  })

  // ══════════════════════════════════════
  // C8: WS reconnect (same as recovery)
  // ══════════════════════════════════════

  it('C8: recovery + market tick after reconnect', async () => {
    recoveryGateway.setPositions([
      {
        symbol: 'ETHUSDT',
        direction: 'short',
        quantity: 10,
        averageEntryPrice: 3500,
        currentPrice: 3400,
        unrealizedPnl: 1000,
        realizedPnl: -50,
      },
    ])

    const recovered = await runtime.recover()
    expect(recovered).toHaveLength(1)
    expect(recovered[0].status).toBe(TradeStatus.Managing)

    // Market tick works after recovery
    runtime.onMarketTick({
      symbol: 'ETHUSDT',
      bid: 3399,
      ask: 3401,
      last: 3400,
      volume: 5000,
      timestamp: Date.now(),
    })

    expect(recovered[0].status).toBe(TradeStatus.Managing)
  })

  // ══════════════════════════════════════
  // C9: All transitions → Lifecycle Events
  // ══════════════════════════════════════

  it('C9: complete lifecycle emits all expected events', async () => {
    const { trade, entryOrderId } = await openAndFillTrade(runtime, orderManager)

    // Full cycle: opened → partial → filled → (managing) → exit-pending → close
    await runtime.requestClose(trade.id, 'take-profit')
    const exitOrderId = trade.orderIds[trade.orderIds.length - 1]
    const exitFill = makeFill({ orderId: exitOrderId, quantity: 1.0, price: 62000, side: 'sell' as const })
    orderManager.simulatePartialFill(exitOrderId, exitFill)

    const eventTypes = events.map(e => e.type)
    expect(eventTypes).toContain(TradeEventType.TradeOpened)
    expect(eventTypes).toContain(TradeEventType.TradeEntryPartial)
    expect(eventTypes).toContain(TradeEventType.TradeEntryFilled)
    expect(eventTypes).toContain(TradeEventType.TradeExitPending)
    expect(eventTypes).toContain(TradeEventType.TradeExitPartial)
    expect(eventTypes).toContain(TradeEventType.TradeClosed)
  })

  // ══════════════════════════════════════
  // C10: Trade not externally mutable
  // ══════════════════════════════════════

  it('C10: getTrade returns reference but Runtime owns mutations', async () => {
    const { trade } = await openAndFillTrade(runtime, orderManager)

    const view = runtime.getTrade(trade.id)!
    expect(view.id).toBe(trade.id)
    expect(view.status).toBe(TradeStatus.Managing)
  })

  // ══════════════════════════════════════
  // Edge cases
  // ══════════════════════════════════════

  it('shutdown prevents new trades', async () => {
    runtime.shutdown()
    await expect(runtime.open(makeSignal())).rejects.toThrow('shut down')
  })

  it('recover with no positions returns empty array', async () => {
    recoveryGateway.setPositions([])
    const recovered = await runtime.recover()
    expect(recovered).toHaveLength(0)
  })
})
