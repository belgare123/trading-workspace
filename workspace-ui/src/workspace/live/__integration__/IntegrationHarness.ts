/**
 * IntegrationHarness.ts — Test harness for Runtime Integration Scenarios
 *
 * Wires all Runtime components together with mock implementations
 * for deterministic integration testing.
 *
 * @since 4.9
 */

import type { BrokerAdapter, ConnectionAdapter } from '../BrokerAdapter'
import type { MockBrokerConfig } from '../../brokers/MockBrokerAdapter'

// ── Core Types ──

export interface OrderRequest {
  id: string
  strategyId: string
  symbol: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit' | 'stop'
  quantity: number
  price?: number
  stopPrice?: number
  timestamp: number
  timeInForce?: 'GTC' | 'IOC' | 'FOK'
}

export interface Order {
  id: string
  clientOrderId: string
  strategyId: string
  symbol: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit' | 'stop'
  quantity: number
  filledQuantity: number
  price: number | null
  stopPrice: number | null
  status: 'pending' | 'open' | 'filled' | 'cancelled' | 'rejected'
  timestamp: number
  updatedAt: number
}

export interface Fill {
  id: string
  orderId: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  commission: number
  timestamp: number
}

export interface Position {
  symbol: string
  direction: 'long' | 'short' | 'flat'
  quantity: number
  averageEntryPrice: number
  currentPrice: number
  unrealizedPnl: number
  realizedPnl: number
}

export interface MarketSnapshot {
  symbol: string
  bid: number
  ask: number
  last: number
  volume: number
  timestamp: number
}

export type GatewayStatus = {
  connected: boolean
  mode: string
  uptime: number
  activeOrders: number
  openPositions: number
  totalEquity?: number
  unrealizedPnl?: number
}

// ── Mock Feed ──

export class MockFeed {
  private listeners: Map<string, Set<(snapshot: MarketSnapshot) => void>> = new Map()
  private timer: ReturnType<typeof setInterval> | null = null
  private prices = new Map<string, number>()
  private baseTime: number

  constructor() {
    this.baseTime = Date.now()
    // Default prices
    this.prices.set('BTC/USDT', 30000)
    this.prices.set('ETH/USDT', 2000)
  }

  on(symbol: string, cb: (snapshot: MarketSnapshot) => void): () => void {
    if (!this.listeners.has(symbol)) this.listeners.set(symbol, new Set())
    this.listeners.get(symbol)!.add(cb)
    return () => this.listeners.get(symbol)?.delete(cb)
  }

  setPrice(symbol: string, price: number): void {
    this.prices.set(symbol, price)
  }

  start(intervalMs = 1000): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      // Simulate small price movement
      for (const [symbol, price] of this.prices) {
        const change = price * (Math.random() - 0.5) * 0.002 // ±0.1%
        const newPrice = Math.max(price + change, 1)
        this.prices.set(symbol, newPrice)
        const snapshot: MarketSnapshot = {
          symbol,
          bid: newPrice * 0.999,
          ask: newPrice * 1.001,
          last: newPrice,
          volume: 100 + Math.random() * 900,
          timestamp: Date.now(),
        }
        this.listeners.get(symbol)?.forEach(cb => cb(snapshot))
      }
    }, intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getPrice(symbol: string): number {
    return this.prices.get(symbol) ?? 0
  }
}

// ── Mock Paper Provider (simplified for testing) ──

export class MockPaperGateway {
  readonly id = 'paper-test'
  readonly mode = 'paper'

  private balance = 10_000
  private orders = new Map<string, Order>()
  private positions = new Map<string, Position>()
  private feed: MockFeed | null = null
  private listeners: Map<string, Set<(event: any) => void>> = new Map()
  private status: 'disconnected' | 'connected' = 'disconnected'
  private startTime = 0

  connect(feed: MockFeed): void {
    this.feed = feed
    this.status = 'connected'
    this.startTime = Date.now()

    // Subscribe to price updates
    feed.on('BTC/USDT', (s) => this.handlePrice('BTC/USDT', s.last))
    feed.on('ETH/USDT', (s) => this.handlePrice('ETH/USDT', s.last))
  }

  disconnect(): void {
    this.feed = null
    this.status = 'disconnected'
  }

  getStatus(): GatewayStatus {
    return {
      connected: this.status === 'connected',
      mode: this.mode,
      uptime: this.status === 'connected' ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      activeOrders: [...this.orders.values()].filter(o => o.status === 'open' || o.status === 'pending').length,
      openPositions: [...this.positions.values()].filter(p => p.direction !== 'flat').length,
      totalEquity: this.balance + this.calcUnrealizedPnl(),
      unrealizedPnl: this.calcUnrealizedPnl(),
    }
  }

  async placeOrder(request: OrderRequest): Promise<{ accepted: boolean; orderId: string; message: string }> {
    if (this.status !== 'connected') {
      return { accepted: false, orderId: request.id, message: 'Not connected' }
    }

    // Check balance
    if (request.side === 'buy') {
      const cost = (request.price ?? 0) * request.quantity
      if (cost > this.balance) {
        return { accepted: false, orderId: request.id, message: 'Insufficient balance' }
      }
    }

    const order: Order = {
      id: request.id,
      clientOrderId: `c_${request.id}`,
      strategyId: request.strategyId,
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      quantity: request.quantity,
      filledQuantity: 0,
      price: request.price ?? null,
      stopPrice: request.stopPrice ?? null,
      status: request.type === 'market' ? 'filled' : 'open',
      timestamp: request.timestamp,
      updatedAt: Date.now(),
    }

    this.orders.set(order.id, order)
    this.emit('order:accepted', { order })

    if (request.type === 'market') {
      // Immediate fill
      const fillPrice = this.feed?.getPrice(request.symbol) ?? request.price ?? 0
      order.filledQuantity = order.quantity
      order.status = 'filled'
      order.updatedAt = Date.now()

      const fill: Fill = {
        id: `fill_${order.id}`,
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: fillPrice,
        commission: order.quantity * fillPrice * 0.001,
        timestamp: Date.now(),
      }

      // Update balance
      const cost = fill.quantity * fill.price + fill.commission
      if (fill.side === 'buy') {
        this.balance -= cost
      } else {
        this.balance += fill.quantity * fill.price - fill.commission
      }

      // Update position
      this.applyFillToPosition(fill)

      this.emit('order:filled', { order, fill })
      this.emit('trade:recorded', { trade: { ...fill, strategyId: order.strategyId } })
    }

    return { accepted: true, orderId: order.id, message: 'Order accepted' }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId)
    if (!order || order.status === 'filled' || order.status === 'cancelled') return false
    order.status = 'cancelled'
    order.updatedAt = Date.now()
    this.emit('order:cancelled', { order })
    return true
  }

  async getOrders(filter?: { status?: string }): Promise<Order[]> {
    const all = [...this.orders.values()]
    if (filter?.status) {
      return all.filter(o => o.status === filter.status)
    }
    return all
  }

  async getPositions(): Promise<Position[]> {
    return [...this.positions.values()].filter(p => p.direction !== 'flat')
  }

  async getBalance(): Promise<{ totalEquity: number; balances: Record<string, { free: number; locked: number }> }> {
    return {
      totalEquity: this.balance + this.calcUnrealizedPnl(),
      balances: { USDT: { free: this.balance, locked: 0 } },
    }
  }

  on(event: string, listener: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(listener)
  }

  off(event: string, listener: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(listener)
  }

  // ── Private ──

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(cb => cb(data))
  }

  private handlePrice(symbol: string, price: number): void {
    // Mark positions to market
    for (const pos of this.positions.values()) {
      if (pos.symbol === symbol) {
        pos.currentPrice = price
        if (pos.direction === 'long') {
          pos.unrealizedPnl = (price - pos.averageEntryPrice) * pos.quantity
        } else if (pos.direction === 'short') {
          pos.unrealizedPnl = (pos.averageEntryPrice - price) * pos.quantity
        }
      }
    }
  }

  private applyFillToPosition(fill: Fill): void {
    const existing = this.positions.get(fill.symbol)
    if (!existing || existing.direction === 'flat') {
      this.positions.set(fill.symbol, {
        symbol: fill.symbol,
        direction: fill.side === 'buy' ? 'long' : 'short',
        quantity: fill.quantity,
        averageEntryPrice: fill.price,
        currentPrice: fill.price,
        unrealizedPnl: 0,
        realizedPnl: 0,
      })
    } else {
      // Adjust existing position
      const pos = existing
      if ((fill.side === 'buy' && pos.direction === 'long') || (fill.side === 'sell' && pos.direction === 'short')) {
        // Increasing position
        const totalQty = pos.quantity + fill.quantity
        pos.averageEntryPrice = (pos.averageEntryPrice * pos.quantity + fill.price * fill.quantity) / totalQty
        pos.quantity = totalQty
      } else {
        // Reducing position
        const fillQty = Math.min(fill.quantity, pos.quantity)
        const pnl = (fill.price - pos.averageEntryPrice) * fillQty * (pos.direction === 'long' ? 1 : -1)
        pos.realizedPnl += pnl
        pos.quantity -= fillQty
        this.balance += pnl
        if (pos.quantity <= 0) {
          pos.direction = 'flat'
          pos.quantity = 0
        }
      }
    }
  }

  private calcUnrealizedPnl(): number {
    let total = 0
    for (const pos of this.positions.values()) {
      if (pos.direction !== 'flat') {
        total += pos.unrealizedPnl
      }
    }
    return total
  }
}

// ── Mock History Store ──

export class MockHistoryStore {
  orders: Order[] = []
  fills: Fill[] = []
  events: Array<{ type: string; timestamp: number; data: unknown }> = []

  recordOrder(order: Order): void {
    this.orders.push(order)
  }

  recordFill(order: Order, fill: Fill): void {
    this.fills.push(fill)
  }

  recordEvent(type: string, data: unknown): void {
    this.events.push({ type, timestamp: Date.now(), data })
  }

  getBySymbol(symbol: string): { orders: Order[]; fills: Fill[] } {
    return {
      orders: this.orders.filter(o => o.symbol === symbol),
      fills: this.fills.filter(f => f.symbol === symbol),
    }
  }

  clear(): void {
    this.orders = []
    this.fills = []
    this.events = []
  }
}

// ── Integration Harness ──

export class IntegrationHarness {
  readonly feed: MockFeed
  readonly gateway: MockPaperGateway
  readonly history: MockHistoryStore
  private killSwitchActive = false
  private rateLimiterDelay = 0

  constructor() {
    this.feed = new MockFeed()
    this.gateway = new MockPaperGateway()
    this.history = new MockHistoryStore()

    // Wire gateway events to history
    this.gateway.on('order:accepted', (data: any) => {
      this.history.recordOrder(data.order)
      this.history.recordEvent('ORDER_ACCEPTED', data)
    })
    this.gateway.on('order:filled', (data: any) => {
      this.history.recordFill(data.order, data.fill)
      this.history.recordEvent('ORDER_FILLED', data)
    })
    this.gateway.on('order:cancelled', (data: any) => {
      this.history.recordEvent('ORDER_CANCELLED', data)
    })
    this.gateway.on('trade:recorded', (data: any) => {
      this.history.recordEvent('TRADE_RECORDED', data)
    })
  }

  async start(): Promise<void> {
    this.feed.start(500) // Tick every 500ms
    this.gateway.connect(this.feed)
    await this.wait(200) // Let feed settle
  }

  async stop(): Promise<void> {
    this.feed.stop()
    this.gateway.disconnect()
  }

  async placeOrder(request: {
    symbol: string
    side: 'buy' | 'sell'
    type: 'market' | 'limit'
    quantity: number
    price?: number
  }): Promise<{ success: boolean; orderId: string; message: string }> {
    // Kill switch check
    if (this.killSwitchActive) {
      return { success: false, orderId: '', message: 'Kill switch active' }
    }

    // Simulate rate limiter delay
    if (this.rateLimiterDelay > 0) {
      await this.wait(this.rateLimiterDelay)
    }

    const id = `order_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const result = await this.gateway.placeOrder({
      id,
      strategyId: 'integration-test',
      ...request,
      timestamp: Date.now(),
    })

    return { success: result.accepted, orderId: result.orderId, message: result.message }
  }

  setKillSwitch(active: boolean): void {
    this.killSwitchActive = active
  }

  setRateLimiterDelay(ms: number): void {
    this.rateLimiterDelay = ms
  }

  async cancelAllOrders(): Promise<number> {
    const orders = await this.gateway.getOrders({ status: 'open' })
    let cancelled = 0
    for (const o of orders) {
      const ok = await this.gateway.cancelOrder(o.id)
      if (ok) cancelled++
    }
    return cancelled
  }

  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  reset(): void {
    this.history.clear()
    this.killSwitchActive = false
    this.rateLimiterDelay = 0
  }
}
