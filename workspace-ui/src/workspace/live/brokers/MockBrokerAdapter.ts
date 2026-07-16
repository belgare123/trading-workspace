/**
 * MockBrokerAdapter.ts — Deterministic mock for testing
 *
 * Simulates a real broker with in-memory state.
 * Supports configurable latency, fill behavior, and error scenarios.
 *
 * @since 4.6
 */

import type {
  BrokerAdapter,
  ConnectionAdapter,
  OrderAdapter,
  PositionAdapter,
  AccountAdapter,
} from '../live/BrokerAdapter'
import type { BrokerCapabilities } from '../live/BrokerCapabilities'
import type {
  BrokerOrder,
  BrokerPosition,
  BrokerBalance,
  BrokerAccountInfo,
  BrokerFill,
  BrokerPlacementParams,
} from '../live/types'
import { MOCK_CAPABILITIES } from '../live/BrokerCapabilities'
import { ValidationError, ExchangeRejectedError } from '../live/BrokerError'

export interface MockBrokerConfig {
  /** Simulated fill latency in ms (default: 50) */
  fillLatencyMs?: number
  /** Simulated network latency in ms (default: 20) */
  networkLatencyMs?: number
  /** Starting balances (default: USDT=10000) */
  balances?: Record<string, number>
  /** Should placements randomly fail */
  failRate?: number
}

/**
 * Shared mutable state for MockBrokerAdapter and its sub-adapters.
 * Exposed as public so inner classes can access it.
 */
interface MockBrokerState {
  connected: boolean
  config: Required<MockBrokerConfig>
  orderHandlers: Array<(order: BrokerOrder) => void>
  fillHandlers: Array<(fill: BrokerFill) => void>
  positionHandlers: Array<(pos: BrokerPosition) => void>
  balanceHandlers: Array<(balances: Record<string, BrokerBalance>) => void>
}

export class MockBrokerAdapter implements BrokerAdapter {
  readonly id = 'mock'
  readonly name = 'Mock Exchange'
  readonly capabilities: BrokerCapabilities = MOCK_CAPABILITIES

  readonly connection: ConnectionAdapter
  readonly orders: OrderAdapter
  readonly positions: PositionAdapter
  readonly account: AccountAdapter
  readonly state: MockBrokerState

  constructor(config: MockBrokerConfig = {}) {
    this.state = {
      connected: false,
      config: {
        fillLatencyMs: 50,
        networkLatencyMs: 20,
        balances: { USDT: 10000 },
        failRate: 0,
        ...config,
      },
      orderHandlers: [],
      fillHandlers: [],
      positionHandlers: [],
      balanceHandlers: [],
    }

    this.connection = new MockConnectionAdapter(this)
    this.orders = new MockOrderAdapter(this)
    this.positions = new MockPositionAdapter(this)
    this.account = new MockAccountAdapter(this)
  }

  dispose(): Promise<void> {
    this.state.connected = false
    return Promise.resolve()
  }
}

// ── Connection ──

class MockConnectionAdapter implements ConnectionAdapter {
  private owner: MockBrokerAdapter

  constructor(owner: MockBrokerAdapter) {
    this.owner = owner
  }

  async connect(): Promise<void> {
    await this.delay(30)
    this.owner.state.connected = true
  }

  async disconnect(): Promise<void> {
    this.owner.state.connected = false
  }

  isConnected(): boolean {
    return this.owner.state.connected
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
  }
}

// ── Orders ──

class MockOrderAdapter implements OrderAdapter {
  private owner: MockBrokerAdapter
  private orders = new Map<string, BrokerOrder>()
  private fills: BrokerFill[] = []
  private orderIdCounter = 0

  constructor(owner: MockBrokerAdapter) {
    this.owner = owner
  }

  subscribeOrders(handler: (order: BrokerOrder) => void): () => void {
    this.owner.state.orderHandlers.push(handler)
    return () => {
      const idx = this.owner.state.orderHandlers.indexOf(handler)
      if (idx >= 0) this.owner.state.orderHandlers.splice(idx, 1)
    }
  }

  subscribeFills(handler: (fill: BrokerFill) => void): () => void {
    this.owner.state.fillHandlers.push(handler)
    return () => {
      const idx = this.owner.state.fillHandlers.indexOf(handler)
      if (idx >= 0) this.owner.state.fillHandlers.splice(idx, 1)
    }
  }

  async placeOrder(params: BrokerPlacementParams): Promise<BrokerOrder> {
    await this.delay()
    this.checkError()

    if (params.quantity <= 0) {
      throw new ValidationError('Invalid quantity')
    }

    const brokerOrderId = `mock-order-${++this.orderIdCounter}`
    const now = Date.now()

    const order: BrokerOrder = {
      brokerOrderId,
      clientOrderId: params.clientOrderId,
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      status: 'NEW',
      quantity: params.quantity,
      filledQuantity: 0,
      price: params.price,
      stopPrice: params.stopPrice,
      averagePrice: params.price ?? 0,
      commission: 0,
      timeInForce: params.timeInForce ?? 'GTC',
      reduceOnly: params.reduceOnly,
      createdAt: now,
      updatedAt: now,
    }

    this.orders.set(brokerOrderId, order)
    this.notifyOrder(order)

    // Simulate partial/total fill after latency
    if (params.type === 'MARKET' || params.type === 'market') {
      setTimeout(() => this.fillOrder(brokerOrderId), this.owner.state.config.fillLatencyMs)
    }

    return order
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    await this.delay()
    const order = this.orders.get(orderId)
    if (!order || order.status === 'FILLED' || order.status === 'CANCELLED') return false

    order.status = 'CANCELLED'
    order.updatedAt = Date.now()
    this.notifyOrder(order)
    return true
  }

  async cancelAllOrders(symbol?: string): Promise<number> {
    let count = 0
    for (const [, order] of this.orders.entries()) {
      if (symbol && order.symbol !== symbol) continue
      if (order.status === 'NEW' || order.status === 'PARTIALLY_FILLED') {
        order.status = 'CANCELLED'
        order.updatedAt = Date.now()
        this.notifyOrder(order)
        count++
      }
    }
    return count
  }

  async replaceOrder(_orderId: string, params: Partial<BrokerPlacementParams>): Promise<BrokerOrder> {
    await this.delay()
    const order = this.orders.get(_orderId)
    if (!order) throw new ValidationError(`Order ${_orderId} not found`)

    if (params.quantity !== undefined) order.quantity = params.quantity
    if (params.price !== undefined) order.price = params.price
    if (params.stopPrice !== undefined) order.stopPrice = params.stopPrice
    order.updatedAt = Date.now()

    this.notifyOrder(order)
    return order
  }

  async getOrder(orderId: string): Promise<BrokerOrder | null> {
    return this.orders.get(orderId) ?? null
  }

  async getOpenOrders(symbol?: string): Promise<BrokerOrder[]> {
    const result: BrokerOrder[] = []
    for (const order of this.orders.values()) {
      if (order.status === 'NEW' || order.status === 'PARTIALLY_FILLED') {
        if (!symbol || order.symbol === symbol) result.push(order)
      }
    }
    return result
  }

  async getOrderHistory(symbol: string, limit = 50): Promise<BrokerOrder[]> {
    const result: BrokerOrder[] = []
    for (const order of this.orders.values()) {
      if (order.symbol === symbol) result.push(order)
    }
    return result.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
  }

  private fillOrder(orderId: string): void {
    const order = this.orders.get(orderId)
    if (!order || order.status === 'CANCELLED') return

    order.status = 'FILLED'
    order.filledQuantity = order.quantity
    order.averagePrice = order.price ?? 100
    order.commission = order.filledQuantity * order.averagePrice * 0.001
    order.updatedAt = Date.now()

    const fill: BrokerFill = {
      id: `fill-${orderId}-${order.updatedAt}`,
      orderId: order.clientOrderId ?? orderId,
      brokerOrderId: orderId,
      symbol: order.symbol,
      side: order.side,
      quantity: order.filledQuantity,
      price: order.averagePrice,
      commission: order.commission,
      commissionAsset: 'USDT',
      realizedPnl: order.side === 'sell' ? (order.averagePrice - (order.price ?? 100)) * order.filledQuantity : 0,
      timestamp: order.updatedAt,
    }

    this.fills.push(fill)
    this.notifyOrder(order)
    this.notifyFill(fill)
  }

  private notifyOrder(order: BrokerOrder): void {
    for (const h of this.owner.state.orderHandlers) h({ ...order })
  }

  private notifyFill(fill: BrokerFill): void {
    for (const h of this.owner.state.fillHandlers) h({ ...fill })
  }

  private delay(): Promise<void> {
    return new Promise((r) => setTimeout(r, this.owner.state.config.networkLatencyMs))
  }

  private checkError(): void {
    if (Math.random() < this.owner.state.config.failRate) {
      throw new ExchangeRejectedError('Mock exchange rejected order')
    }
  }
}

// ── Positions ──

class MockPositionAdapter implements PositionAdapter {
  private owner: MockBrokerAdapter
  private positions = new Map<string, BrokerPosition>()

  constructor(owner: MockBrokerAdapter) {
    this.owner = owner
  }

  subscribePositions(handler: (pos: BrokerPosition) => void): () => void {
    this.owner.state.positionHandlers.push(handler)
    return () => {
      const idx = this.owner.state.positionHandlers.indexOf(handler)
      if (idx >= 0) this.owner.state.positionHandlers.splice(idx, 1)
    }
  }

  async getPositions(symbol?: string): Promise<BrokerPosition[]> {
    const result: BrokerPosition[] = []
    for (const pos of this.positions.values()) {
      if (!symbol || pos.symbol === symbol) result.push(pos)
    }
    return result
  }

  async getPosition(symbol: string): Promise<BrokerPosition | null> {
    return this.positions.get(symbol) ?? null
  }
}

// ── Account ──

class MockAccountAdapter implements AccountAdapter {
  private owner: MockBrokerAdapter

  constructor(owner: MockBrokerAdapter) {
    this.owner = owner
  }

  subscribeBalances(handler: (balances: Record<string, BrokerBalance>) => void): () => void {
    this.owner.state.balanceHandlers.push(handler)
    return () => {
      const idx = this.owner.state.balanceHandlers.indexOf(handler)
      if (idx >= 0) this.owner.state.balanceHandlers.splice(idx, 1)
    }
  }

  async getBalances(): Promise<Record<string, BrokerBalance>> {
    const result: Record<string, BrokerBalance> = {}
    for (const [asset, total] of Object.entries(this.owner.state.config.balances)) {
      result[asset] = {
        asset,
        free: total,
        locked: 0,
        total,
      }
    }
    return result
  }

  async getAccountInfo(): Promise<BrokerAccountInfo> {
    const balances = await this.getBalances()
    const totalEquity = Object.values(balances).reduce((s, b) => s + b.total, 0)
    return {
      balances,
      totalEquity,
      unrealizedPnl: 0,
      canTrade: true,
      isTestnet: true,
    }
  }
}
