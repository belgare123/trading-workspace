/**
 * BybitExecutionGateway.ts — Bybit gateway implementing ExecutionGateway
 *
 * Wraps BybitBrokerAdapter in the ExecutionGateway interface,
 * compatible with GatewayRuntime + RiskRuntime.
 * Implements RiskContextSource so RiskRuntime can query
 * positions, account, and market state during pre-trade checks.
 *
 * @since 4.9E
 * @system State Reconciliation
 */

import type { ExecutionGateway } from './ExecutionGateway'
import type { GatewayConfig, GatewayStatus, OrderResult } from './ExecutionGateway'
import { ExecutionMode } from './ExecutionMode'
import type { OrderRequest, Order, Position, Fill } from '../../execution/types'
import type { BybitBrokerAdapter } from '../brokers/BybitBrokerAdapter'
import type { BrokerPlacementParams, BrokerOrder, BrokerBalance } from '../live/types'
import type { RiskContextSource } from '../../risk/runtime/RiskContext'
import type { RiskPosition, RiskAccount } from '../../risk/types'
import type { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'
import { OrderStateReconciler } from '../live/OrderStateReconciler'
import type { LocalStateProvider } from '../live/OrderStateReconciler'
import { ExecutionRecoveryRuntime } from '../live/ExecutionRecoveryRuntime'
import type { RecoveryReport } from '../live/ExecutionRecoveryRuntime'

// Sync local state provider for reconciliation — reads from gateway's caches directly
class GatewayLocalStateProvider implements LocalStateProvider {
  private gw: BybitExecutionGateway
  constructor(gw: BybitExecutionGateway) { this.gw = gw }
  getOrders() { return this.gw['localOrders'] }
  getPositions() { return this.gw['localExecutionPositions'] }
  getBalances() { return this.gw['cachedBalances'] }
}

export class BybitExecutionGateway implements ExecutionGateway, RiskContextSource {
  readonly id = 'bybit-gateway'
  readonly mode = ExecutionMode.Live

  private broker: BybitBrokerAdapter
  private config: GatewayConfig | null = null
  private startTime = 0
  private activeOrderCount = 0
  private openPositionCount = 0
  private readonly testnet: boolean

  // ── State Reconciliation ──
  readonly reconciler: OrderStateReconciler
  readonly recovery: ExecutionRecoveryRuntime
  private localStateProvider: GatewayLocalStateProvider
  private eventBus?: ExecutionEventBus

  // Local order/position cache for LocalStateProvider
  private localOrders: Order[] = []
  private localExecutionPositions: Position[] = []

  // Cached state for RiskContextSource
  private cachedPositions: Map<string, RiskPosition> = new Map()
  private cachedAccount: RiskAccount = {
    totalEquity: 0,
    freeBalance: 0,
    usedMargin: 0,
    unrealizedPnl: 0,
    realizedPnl: 0,
    dailyPnl: 0,
    dailyTrades: 0,
    currency: 'USDT',
  }
  private cachedBalances: Record<string, { asset: string; free: number; locked: number }> = {}
  private cachedPrices: Map<string, number> = new Map()

  constructor(
    broker: BybitBrokerAdapter,
    testnet = false,
    eventBus?: ExecutionEventBus,
  ) {
    this.broker = broker
    this.testnet = testnet
    this.eventBus = eventBus

    // Create reconciler + recovery runtime
    this.localStateProvider = new GatewayLocalStateProvider(this)
    this.reconciler = new OrderStateReconciler(
      broker,
      this.localStateProvider,
      { strictMode: true, eventBus },
    )
    this.recovery = new ExecutionRecoveryRuntime(
      broker,
      this.reconciler,
      {
        mode: 'restore',
        resubmitPending: true,
        maxResubmit: 5,
        resubmitDelayMs: 1000,
        restorePositions: true,
        autoRecovery: true,
      },
      eventBus,
    )
    this.recovery.setLocalState(this.localStateProvider)
  }

  // ── LocalStateProvider (delegated to GatewayLocalStateProvider) ──

  // ── ExecutionGateway Lifecycle ──

  async connect(config: GatewayConfig): Promise<void> {
    this.config = config
    this.startTime = Date.now()
    const creds = config.credentials ?? {}
    await this.broker.connection.connect(
      creds.apiKey ?? '',
      creds.apiSecret ?? '',
      this.testnet,
    )

    // ── Phase 1: Refresh exchange state ──
    await this.refreshState()

    // ── Phase 2: Full reconciliation ──
    await this.runReconciliation()
  }

  /**
   * Execute full reconciliation cycle.
   * Calls OrderStateReconciler to diff local vs broker state,
   * then runs ExecutionRecoveryRuntime to generate missed events.
   */
  async runReconciliation(): Promise<RecoveryReport> {
    try {
      // First, fetch current broker state for local cache
      await this.refreshState()

      // Run OrderStateReconciler directly to emit missed events
      const result = await this.reconciler.reconcile()
      if (result.issues.length > 0) {
        if (this.eventBus) {
          this.eventBus.emit({
            type: 'RECOVERY_COMPLETE' as 'ORDER_EXPIRED', // passthrough — compatible shape
            detail: `Reconciliation found ${result.issues.length} issues: ` +
              `${result.issues.filter(i => i.severity === 'error').length} errors, ` +
              `${result.issues.filter(i => i.severity === 'warning').length} warnings`,
            timestamp: Date.now(),
            order: [] as unknown as import('../../execution/types').Order,
          } as unknown as import('../../execution/events/ExecutionEvents').ExecutionEvent)
        }
      }

      // Run recovery runtime for order resubmission
      return await this.recovery.recover()
    } catch (err) {
      if (this.eventBus) {
        this.eventBus.emit({
          type: 'RECOVERY_FAILED' as 'ORDER_EXPIRED', // passthrough
          detail: `Reconciliation failed: ${(err as Error).message}`,
          timestamp: Date.now(),
          order: [] as unknown as import('../../execution/types').Order,
        } as unknown as import('../../execution/events/ExecutionEvents').ExecutionEvent)
      }
      return {
        config: { mode: 'restore', resubmitPending: false, maxResubmit: 0, resubmitDelayMs: 0, restorePositions: false, autoRecovery: false },
        phase: 'failed',
        startTime: Date.now(),
        success: false,
        error: (err as Error).message,
        resubmittedCount: 0,
        openOrdersFound: 0,
        openPositionsFound: 0,
      }
    }
  }

  /**
   * Refresh cached state from exchange.
   * Non-fatal — continues with stale cache if any single fetch fails.
   */
  /** Force-refresh local state from the exchange (public for KillSwitch etc.) */
  async refresh(): Promise<void> {
    return this.refreshState()
  }

  /** Get the current account snapshot for monitoring */
  getAccountSnapshot(): { equity: number; peakEquity?: number; dailyPnl?: number } {
    return {
      equity: this.cachedAccount.totalEquity,
      dailyPnl: this.cachedAccount.dailyPnl,
    }
  }

  // ── Private ──

  private async refreshState(): Promise<void> {
    // 1. Fetch open orders → count + local cache
    try {
      const brokerOrders = await this.broker.orders.getOpenOrders()
      this.activeOrderCount = brokerOrders.length
      this.localOrders = brokerOrders.map(o => this.toOrder(o))
    } catch {
      this.activeOrderCount = 0
    }

    // 2. Fetch positions → count + cache for RiskContextSource + LocalStateProvider
    try {
      const positions = await this.broker.positions.getPositions()
      this.openPositionCount = positions.length
      this.localExecutionPositions = positions.map(p => ({
        symbol: p.symbol,
        direction: p.side,
        quantity: p.size,
        averageEntryPrice: p.avgPrice,
        currentPrice: p.avgPrice,
        unrealizedPnl: p.unrealizedPnl,
        realizedPnl: p.realizedPnl ?? 0,
        liquidationPrice: p.liquidationPrice ?? 0,
        leverage: p.leverage ?? 1,
        margin: 0,
        updatedAt: p.updatedAt,
      }))

      const posMap = new Map<string, RiskPosition>()
      for (const p of positions) {
        if (p.size > 0) {
          posMap.set(p.symbol, {
            symbol: p.symbol,
            size: p.size,
            side: p.side,
            entryPrice: p.avgPrice,
            markPrice: p.avgPrice,
            unrealizedPnl: p.unrealizedPnl,
            leverage: p.leverage ?? 1,
          })
          this.cachedPrices.set(p.symbol, p.avgPrice)
        }
      }
      this.cachedPositions = posMap
    } catch {
      this.openPositionCount = 0
    }

    // 3. Fetch balances → account cache + LocalStateProvider cache
    try {
      const balances = await this.broker.account.getBalances()
      let totalEquity = 0
      let freeBalance = 0
      this.cachedBalances = {}
      for (const [asset, bal] of Object.entries(balances)) {
        const free = Number.isFinite(bal.free) ? bal.free : 0
        const locked = Number.isFinite(bal.locked) ? bal.locked : 0
        this.cachedBalances[asset] = { asset, free, locked }
        totalEquity += Number.isFinite(bal.total) ? bal.total : 0
        freeBalance += free
      }
      this.cachedAccount = {
        totalEquity,
        freeBalance,
        usedMargin: totalEquity - freeBalance,
        unrealizedPnl: 0,
        realizedPnl: 0,
        dailyPnl: 0,
        dailyTrades: 0,
        currency: 'USDT',
      }
    } catch {
      // Keep default zeros
    }
  }

  async disconnect(): Promise<void> {
    this.config = null
    await this.broker.connection.disconnect()
  }

  getStatus(): GatewayStatus {
    const connected = this.broker.connection.isConnected()
    return {
      connected,
      mode: ExecutionMode.Live,
      uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      activeOrders: this.activeOrderCount,
      openPositions: this.openPositionCount,
    }
  }

  // ── Orders ──

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    const params = this.toBrokerPlacementParams(request)
    try {
      const result = await this.broker.orders.placeOrder(params)
      this.activeOrderCount++

      // Track locally for reconciliation
      const brokerOrder = result as unknown as BrokerOrder
      const order = this.toOrder(brokerOrder)
      this.localOrders = this.localOrders.filter(o => o.id !== order.id)
      this.localOrders.push(order)

      return {
        accepted: true,
        orderId: result.id,
        fills: result.executedQuantity > 0
          ? [{
              id: `${result.id}-fill`,
              orderId: result.id,
              symbol: result.symbol,
              side: result.side,
              quantity: result.executedQuantity,
              price: result.averagePrice ?? result.price,
              commission: 0,
              commissionAsset: 'USDT',
              timestamp: result.updatedAt ?? Date.now(),
            } satisfies Fill]
          : undefined,
      }
    } catch (err) {
      return {
        accepted: false,
        orderId: request.id,
        message: String(err),
      }
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const ok = await this.broker.orders.cancelOrder(orderId)
    if (ok) {
      this.activeOrderCount = Math.max(0, this.activeOrderCount - 1)
      this.localOrders = this.localOrders.filter(o => o.id !== orderId)
    }
    return ok
  }

  async cancelAllOrders(symbol?: string): Promise<number> {
    const count = await this.broker.orders.cancelAllOrders(symbol)
    this.activeOrderCount = Math.max(0, this.activeOrderCount - count)
    if (!symbol) this.localOrders = []
    else this.localOrders = this.localOrders.filter(o => o.symbol !== symbol)
    return count
  }

  async replaceOrder(orderId: string, request: Partial<OrderRequest>): Promise<OrderResult> {
    const params: Partial<BrokerPlacementParams> = {}
    if (request.quantity !== undefined) params.quantity = request.quantity
    if (request.price !== undefined) params.price = request.price
    if (request.side !== undefined) params.side = request.side

    try {
      const result = await this.broker.orders.amendOrder(orderId, params)
      // Refresh local order
      try {
        const updated = await this.broker.orders.getOrder(orderId)
        if (updated) {
          this.localOrders = this.localOrders.filter(o => o.id !== orderId)
          this.localOrders.push(this.toOrder(updated))
        }
      } catch { /* ignore refresh failure */ }
      return {
        accepted: true,
        orderId: result.id,
      }
    } catch (err) {
      return {
        accepted: false,
        orderId,
        message: String(err),
      }
    }
  }

  // ── Queries ──

  async getOrders(filter?: { symbol?: string; status?: string; limit?: number }): Promise<Order[]> {
    let brokerOrders: BrokerOrder[]
    if (filter?.symbol) {
      brokerOrders = await this.broker.orders.getOrderHistory(filter.symbol, filter.limit ?? 20)
    } else {
      brokerOrders = await this.broker.orders.getOpenOrders(filter?.symbol)
    }
    return brokerOrders.map(o => this.toOrder(o))
  }

  async getPositions(): Promise<Position[]> {
    const positions = await this.broker.positions.getPositions()
    if (!positions) return []
    return positions.map(p => ({
      symbol: p.symbol,
      direction: p.side,
      quantity: p.size,
      averageEntryPrice: p.avgPrice,
      currentPrice: p.avgPrice,
      unrealizedPnl: p.unrealizedPnl,
      realizedPnl: p.realizedPnl ?? 0,
      liquidationPrice: p.liquidationPrice ?? 0,
      leverage: p.leverage ?? 1,
      margin: 0,
      updatedAt: p.updatedAt,
    }))
  }

  async getPosition(symbol: string): Promise<Position | null> {
    const pos = await this.broker.positions.getPosition(symbol)
    if (!pos) return null
    return {
      symbol: pos.symbol,
      direction: pos.side,
      quantity: pos.size,
      averageEntryPrice: pos.avgPrice,
      currentPrice: pos.avgPrice,
      unrealizedPnl: pos.unrealizedPnl,
      realizedPnl: pos.realizedPnl ?? 0,
      liquidationPrice: pos.liquidationPrice ?? 0,
      leverage: pos.leverage ?? 1,
      margin: 0,
      updatedAt: pos.updatedAt,
    }
  }

  async getBalance(): Promise<{
    totalEquity: number
    balances: Record<string, { free: number; locked: number }>
    unrealizedPnl: number
    realizedPnl: number
    mode: string
  }> {
    const balances = await this.broker.account.getBalances()
    const mapped: Record<string, { free: number; locked: number }> = {}
    let totalEquity = 0

    for (const [asset, bal] of Object.entries(balances)) {
      mapped[asset] = { free: bal.free, locked: bal.locked }
      totalEquity += Number.isFinite(bal.total) ? bal.total : 0
    }

    return {
      totalEquity,
      balances: mapped,
      unrealizedPnl: 0,
      realizedPnl: 0,
      mode: ExecutionMode.Live,
    }
  }

  // ── Events (passthrough to broker private WS) ──

  on(event: string, listener: (...args: unknown[]) => void): void {
    // BybitBrokerAdapter doesn't use legacy on/off
  }

  off(_event: string, _listener: (...args: unknown[]) => void): void {
    // No-op
  }

  // ── RiskContextSource ──

  getPositions(_strategyId: string): Map<string, RiskPosition> {
    return this.cachedPositions
  }

  getAccount(_strategyId: string): RiskAccount | undefined {
    return this.cachedAccount
  }

  getMarket(): { prices: Map<string, number>; volumes: Map<string, number>; spreads: Map<string, number>; timestamp: number } | undefined {
    return {
      prices: this.cachedPrices,
      volumes: new Map(),
      spreads: new Map(),
      timestamp: Date.now(),
    }
  }

  // ── Helpers ──

  private toBrokerPlacementParams(request: OrderRequest): BrokerPlacementParams {
    return {
      symbol: request.symbol,
      side: request.side === 'buy' ? 'buy' : 'sell',
      type: (request.type ?? 'limit').toLowerCase() as 'market' | 'limit',
      quantity: request.quantity,
      price: request.price,
      timeInForce: request.timeInForce as 'GTC' | 'IOC' | 'FOK' | 'PostOnly' | undefined,
      reduceOnly: request.reduceOnly,
      postOnly: request.postOnly,
      clientOrderId: request.id,
    }
  }

  private toOrder(o: BrokerOrder): Order {
    return {
      id: o.clientOrderId ?? o.id,
      brokerOrderId: o.id,
      symbol: o.symbol,
      side: o.side,
      type: o.type as Order['type'],
      price: o.price,
      quantity: o.quantity,
      executedQuantity: o.executedQuantity,
      remainingQuantity: o.remainingQuantity,
      status: o.status,
      timeInForce: o.timeInForce as Order['timeInForce'],
      reduceOnly: o.reduceOnly,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      averagePrice: o.averagePrice,
      commission: o.commission,
      commissionAsset: o.commissionAsset,
    }
  }
}
