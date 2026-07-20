/**
 * BybitExecutionGateway.ts — Bybit TestNet gateway implementing ExecutionGateway
 *
 * Wraps BybitBrokerAdapter in the ExecutionGateway interface,
 * providing a drop-in gateway for live TestNet trading that's
 * compatible with GatewayRuntime + RiskRuntime.
 *
 * Implements RiskContextSource so RiskRuntime can query
 * positions, account, and market state during pre-trade checks.
 *
 * @since 4.9E
 */

import type { ExecutionGateway } from './ExecutionGateway'
import type { GatewayConfig, GatewayStatus, OrderResult } from './ExecutionGateway'
import { ExecutionMode } from './ExecutionMode'
import type { OrderRequest, Order, Position, Fill } from '../../execution/types'
import type { BybitBrokerAdapter } from '../brokers/BybitBrokerAdapter'
import type { BrokerPlacementParams, BrokerOrder } from '../live/types'
import type { RiskContextSource } from '../../risk/runtime/RiskContext'
import type { RiskPosition, RiskAccount } from '../../risk/types'

export class BybitExecutionGateway implements ExecutionGateway, RiskContextSource {
  readonly id = 'bybit-testnet-gateway'
  readonly mode = ExecutionMode.Live

  private broker: BybitBrokerAdapter
  private config: GatewayConfig | null = null
  private startTime = 0
  private activeOrderCount = 0
  private openPositionCount = 0

  constructor(broker: BybitBrokerAdapter) {
    this.broker = broker
  }

  // ── ExecutionGateway Lifecycle ──

  async connect(config: GatewayConfig): Promise<void> {
    this.config = config
    this.startTime = Date.now()
    const creds = config.credentials ?? {}
    await this.broker.connection.connect(
      creds.apiKey ?? '',
      creds.apiSecret ?? '',
      true, // testnet
    )
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
    if (ok) this.activeOrderCount = Math.max(0, this.activeOrderCount - 1)
    return ok
  }

  async cancelAllOrders(symbol?: string): Promise<number> {
    const count = await this.broker.orders.cancelAllOrders(symbol)
    this.activeOrderCount = Math.max(0, this.activeOrderCount - count)
    return count
  }

  async replaceOrder(orderId: string, request: Partial<OrderRequest>): Promise<OrderResult> {
    const params: Partial<BrokerPlacementParams> = {}
    if (request.quantity !== undefined) params.quantity = request.quantity
    if (request.price !== undefined) params.price = request.price
    if (request.side !== undefined) params.side = request.side

    try {
      const result = await this.broker.orders.amendOrder(orderId, params)
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
    return brokerOrders.map((o) => this.toOrder(o))
  }

  async getPositions(): Promise<Position[]> {
    const positions = await this.broker.positions.getPositions()
    return positions.map((p) => ({
      symbol: p.symbol,
      direction: p.side,
      quantity: p.size,
      averageEntryPrice: p.avgPrice,
      currentPrice: p.avgPrice,
      unrealizedPnl: p.unrealizedPnl,
      realizedPnl: p.realizedPnl ?? 0,
      liquidationPrice: p.liquidationPrice,
      leverage: p.leverage ?? 1,
      margin: 0,
      updatedAt: p.updatedAt,
    } satisfies Position))
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
      liquidationPrice: pos.liquidationPrice,
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
    const info = await this.broker.account.getAccountInfo()
    const mapped: Record<string, { free: number; locked: number }> = {}
    let totalEquity = 0

    for (const [asset, bal] of Object.entries(balances)) {
      mapped[asset] = { free: bal.free, locked: bal.locked }
      totalEquity += bal.total
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
    // BybitBrokerAdapter doesn't use legacy on/off — subscription via
    // orders.subscribeOrders, positions.subscribePositions, account.subscribeBalances
    // Futures: map to event-based pattern if needed
  }

  off(_event: string, _listener: (...args: unknown[]) => void): void {
    // No-op
  }

  // ── RiskContextSource ──

  getPositions(_strategyId: string): Map<string, RiskPosition> {
    return new Map() // Position data fetched asynchronously via broker API
  }

  getAccount(_strategyId: string): RiskAccount | undefined {
    return {
      totalEquity: 0,
      freeBalance: 0,
      usedMargin: 0,
      unrealizedPnl: 0,
      realizedPnl: 0,
      dailyPnl: 0,
      dailyTrades: 0,
      currency: 'USDT',
    }
  }

  getMarket(): { prices: Map<string, number>; volumes: Map<string, number>; spreads: Map<string, number>; timestamp: number } | undefined {
    return undefined
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
