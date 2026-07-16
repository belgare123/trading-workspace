/**
 * LiveProvider.ts — Live trading provider (orchestrator)
 *
 * LiveProvider is a pure coordinator. It:
 * - Delegates connection/session to BrokerSession
 * - Routes orders through OrderRouter → BrokerAdapter
 * - Syncs positions via PositionSynchronizer
 * - Syncs account via AccountSynchronizer
 * - Converts broker events via BrokerEventAdapter
 * - Queries capabilities via BrokerCapabilities
 *
 * It does NOT:
 * - Compute commissions (broker does)
 * - Calculate positions (broker does)
 * - Maintain its own ledger (broker does)
 * - Determine execution quality (broker does)
 *
 * @since 4.5
 */

import type {
  ExecutionGateway,
  GatewayConfig,
  GatewayStatus,
  AccountInfo,
  OrderResult,
} from '../gateway/ExecutionGateway'
import { ExecutionMode } from '../gateway/ExecutionMode'

import type { OrderRequest, Order, Position } from '../../execution/types'
import type { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'

import type { BrokerAdapter } from './BrokerAdapter'
import type { BrokerCapabilities } from './BrokerCapabilities'
import type { LiveProviderConfig } from './types'
import { ConnectionStates } from './types'
import { BrokerSession } from './BrokerSession'
import { OrderRouter } from './OrderRouter'
import { PositionSynchronizer } from './PositionSynchronizer'
import { AccountSynchronizer } from './AccountSynchronizer'
import { BrokerEventAdapter } from './BrokerEventAdapter'

export class LiveProvider implements ExecutionGateway {
  readonly id: string
  readonly mode = ExecutionMode.Live

  // Sub-components
  readonly session: BrokerSession
  readonly router: OrderRouter
  readonly positionSync: PositionSynchronizer
  readonly accountSync: AccountSynchronizer
  readonly eventAdapter: BrokerEventAdapter

  /** Broker capabilities (feature query) */
  get capabilities(): BrokerCapabilities {
    return this.adapter.capabilities
  }

  // Internal
  private adapter: BrokerAdapter
  private config: LiveProviderConfig
  private eventBus?: ExecutionEventBus
  private startTime = 0
  private _connected = false

  // Event bus subscriptions (direct listeners)
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>()

  constructor(adapter: BrokerAdapter, config: LiveProviderConfig) {
    this.id = `live-${adapter.id}`
    this.adapter = adapter
    this.config = config

    this.session = new BrokerSession(adapter, config)
    this.router = new OrderRouter(adapter)
    this.positionSync = new PositionSynchronizer(adapter)
    this.accountSync = new AccountSynchronizer(adapter)
    this.eventAdapter = new BrokerEventAdapter(adapter)
  }

  // ── ExecutionGateway Lifecycle ──

  async connect(gatewayConfig: GatewayConfig): Promise<void> {
    const apiKey = gatewayConfig.credentials?.apiKey ?? ''
    const apiSecret = gatewayConfig.credentials?.apiSecret ?? ''
    const testnet = gatewayConfig.credentials?.testnet === 'true'

    this.startTime = Date.now()

    try {
      await this.session.connect(apiKey, apiSecret, testnet)

      // Wire up components
      if (this.eventBus) {
        this.router.connectEventBus(this.eventBus)
        this.positionSync.connectEventBus(this.eventBus)
        this.accountSync.connectEventBus(this.eventBus)
        this.eventAdapter.connectEventBus(this.eventBus)
      }

      // Start syncs
      this.eventAdapter.subscribe()
      this.positionSync.start(this.config.positionSyncIntervalMs)
      this.accountSync.start(this.config.accountSyncIntervalMs)

      this._connected = true
    } catch (err) {
      this._connected = false
      throw err
    }
  }

  async disconnect(): Promise<void> {
    this._connected = false

    this.positionSync.stop()
    this.accountSync.stop()
    this.eventAdapter.unsubscribe()

    await this.session.disconnect()
    this.router.clear()
  }

  getStatus(): GatewayStatus {
    return {
      connected: this._connected,
      mode: this.mode,
      uptime: this._connected ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      activeOrders: this.router.pendingCount,
      openPositions: 0,
      error: this.session.state !== ConnectionStates.CONNECTED
        ? `Connection state: ${this.session.state}`
        : undefined,
    }
  }

  // ── Event Bus wiring ──

  /** Attach to platform ExecutionEventBus */
  connectEventBus(bus: ExecutionEventBus): void {
    this.eventBus = bus
  }

  // ── Orders ──

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    const order: Order = {
      id: request.id,
      strategyId: request.strategyId,
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      quantity: request.quantity,
      price: request.price,
      stopPrice: request.stopPrice,
      status: 'pending',
      filledQuantity: 0,
      averagePrice: 0,
      commission: 0,
      timeInForce: request.timeInForce ?? 'GTC',
      clientId: request.clientId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    try {
      const brokerStatus = await this.router.route(order)

      return {
        accepted: true,
        orderId: order.id,
        message: `Live order routed to broker: ${brokerStatus.brokerOrderId}`,
      }
    } catch (err) {
      return {
        accepted: false,
        orderId: request.id,
        message: `Order rejected by broker: ${String(err)}`,
      }
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    return this.router.cancel(orderId)
  }

  async replaceOrder(orderId: string, request: Partial<OrderRequest>): Promise<OrderResult> {
    try {
      const brokerId = this.router.resolveBroker(orderId)
      if (!brokerId) {
        return { accepted: false, orderId, message: 'Order not found' }
      }

      const newOrder: Order = {
        id: orderId,
        strategyId: request.strategyId ?? '',
        symbol: request.symbol ?? '',
        side: request.side ?? 'buy',
        type: request.type ?? 'limit',
        quantity: request.quantity ?? 0,
        price: request.price,
        status: 'pending',
        filledQuantity: 0,
        averagePrice: 0,
        commission: 0,
        timeInForce: 'GTC',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await this.router.route(newOrder)

      return {
        accepted: true,
        orderId,
        message: 'Order replaced on broker',
      }
    } catch (err) {
      return {
        accepted: false,
        orderId,
        message: `Replace failed: ${String(err)}`,
      }
    }
  }

  // ── Query ──

  async getOrders(): Promise<Order[]> {
    try {
      const brokerOrders = await this.adapter.getOpenOrders()
      return brokerOrders.map(b => ({
        id: b.clientOrderId ?? b.brokerOrderId,
        strategyId: '',
        symbol: b.symbol,
        side: b.side === 'buy' ? 'buy' as const : 'sell' as const,
        type: (b.type === 'MARKET' ? 'market' : 'limit') as 'market' | 'limit',
        quantity: b.quantity,
        filledQuantity: b.filledQuantity,
        averagePrice: b.averagePrice,
        price: b.price,
        status: 'pending',
        commission: b.commission,
        timeInForce: 'GTC' as const,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      }))
    } catch {
      return []
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const brokerPositions = await this.adapter.getPositions()
      return brokerPositions.map(p => ({
        symbol: p.symbol,
        direction: p.direction,
        quantity: p.quantity,
        averageEntryPrice: p.averageEntryPrice,
        currentPrice: p.currentPrice,
        unrealizedPnl: p.unrealizedPnl,
        realizedPnl: p.realizedPnl,
        openedAt: 0,
        updatedAt: Date.now(),
      }))
    } catch {
      return []
    }
  }

  async getPosition(symbol: string): Promise<Position | null> {
    try {
      const p = await this.adapter.getPosition(symbol)
      if (!p) return null
      return {
        symbol: p.symbol,
        direction: p.direction,
        quantity: p.quantity,
        averageEntryPrice: p.averageEntryPrice,
        currentPrice: p.currentPrice,
        unrealizedPnl: p.unrealizedPnl,
        realizedPnl: p.realizedPnl,
        openedAt: 0,
        updatedAt: Date.now(),
      }
    } catch {
      return null
    }
  }

  async getBalance(): Promise<AccountInfo> {
    try {
      const info = await this.adapter.getAccountInfo()
      const balances: Record<string, { free: number; locked: number }> = {}
      for (const [asset, bal] of Object.entries(info.balances)) {
        balances[asset] = { free: bal.free, locked: bal.locked }
      }
      return {
        totalEquity: info.totalEquity,
        balances,
        unrealizedPnl: info.unrealizedPnl,
        realizedPnl: 0,
        mode: this.mode,
      }
    } catch {
      return {
        totalEquity: 0,
        balances: {},
        unrealizedPnl: 0,
        realizedPnl: 0,
        mode: this.mode,
      }
    }
  }

  // ── Event Listeners (for ExecutionGateway interface) ──

  on(event: string, listener: (...args: unknown[]) => void): void {
    const existing = this.listeners.get(event) ?? []
    existing.push(listener)
    this.listeners.set(event, existing)
  }

  off(event: string, listener: (...args: unknown[]) => void): void {
    const existing = this.listeners.get(event)
    if (!existing) return
    this.listeners.set(event, existing.filter(l => l !== listener))
  }

  // ── Cleanup ──

  dispose(): void {
    this.positionSync.dispose()
    this.accountSync.dispose()
    this.eventAdapter.dispose()
    this.session.dispose()
    this.listeners.clear()
  }
}
