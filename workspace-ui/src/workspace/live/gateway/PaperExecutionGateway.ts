/**
 * PaperExecutionGateway.ts — Paper-mode gateway implementing ExecutionGateway
 *
 * Wraps PaperBrokerAdapter in the ExecutionGateway interface,
 * providing a drop-in gateway for paper trading that's
 * compatible with GatewayRuntime + RiskRuntime.
 *
 * Implements RiskContextSource so RiskRuntime can query
 * positions, account, and market state during pre-trade checks.
 *
 * @since 4.9
 */

import type { ExecutionGateway } from './ExecutionGateway'
import type { GatewayConfig, GatewayStatus, OrderResult } from './ExecutionGateway'
import { ExecutionMode } from './ExecutionMode'
import type { OrderRequest, Order, Position, Fill } from '../../execution/types'
import type { PaperBrokerAdapter } from '../brokers/PaperBrokerAdapter'
import type { BrokerPlacementParams, BrokerOrder } from '../live/types'
import type { RiskContextSource } from '../../risk/runtime/RiskContext'
import type { RiskPosition, RiskAccount } from '../../risk/types'

export class PaperExecutionGateway implements ExecutionGateway, RiskContextSource {
  readonly id = 'paper-gateway'
  readonly mode = ExecutionMode.Paper

  private broker: PaperBrokerAdapter
  private config: GatewayConfig | null = null
  private startTime = 0

  constructor(broker: PaperBrokerAdapter) {
    this.broker = broker
  }

  // ── ExecutionGateway Lifecycle ──

  async connect(config: GatewayConfig): Promise<void> {
    this.config = config
    this.startTime = Date.now()
    await this.broker.connection.connect()
  }

  async disconnect(): Promise<void> {
    this.config = null
    await this.broker.connection.disconnect()
  }

  getStatus(): GatewayStatus {
    return {
      connected: this.broker.connection.isConnected(),
      mode: ExecutionMode.Paper,
      uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      activeOrders: 0,
      openPositions: 0,
    }
  }

  // ── Orders ──

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    const params = this.toBrokerPlacementParams(request)
    try {
      const result = await this.broker.orders.placeOrder(params)
      return {
        accepted: true,
        orderId: result.brokerOrderId,
        fills: result.filledQuantity > 0 ? [{
          id: `${result.brokerOrderId}-fill`,
          orderId: result.brokerOrderId,
          symbol: result.symbol,
          side: result.side,
          quantity: result.filledQuantity,
          price: result.averagePrice,
          commission: result.commission,
          commissionAsset: result.commissionAsset ?? 'USDT',
          timestamp: result.updatedAt,
        } satisfies Fill] : undefined,
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
    return this.broker.orders.cancelOrder(orderId)
  }

  async cancelAllOrders(symbol?: string): Promise<number> {
    return this.broker.orders.cancelAllOrders(symbol)
  }

  async replaceOrder(orderId: string, request: Partial<OrderRequest>): Promise<OrderResult> {
    const params: Partial<BrokerPlacementParams> = {}
    if (request.quantity !== undefined) params.quantity = request.quantity
    if (request.price !== undefined) params.price = request.price
    if (request.side !== undefined) params.side = request.side
    if (request.type !== undefined) params.type = request.type.toUpperCase()

    const result = await this.broker.orders.replaceOrder(orderId, params)
    return {
      accepted: true,
      orderId: result.brokerOrderId,
    }
  }

  // ── Queries ──

  async getOrders(filter?: { symbol?: string; status?: string; limit?: number }): Promise<Order[]> {
    const brokerOrders = filter?.symbol
      ? await this.broker.orders.getOrderHistory(filter.symbol, filter.limit)
      : await this.broker.orders.getOpenOrders(filter?.symbol)
    return brokerOrders.map((o) => this.toOrder(o))
  }

  async getPositions(): Promise<Position[]> {
    const positions = await this.broker.positions.getPositions()
    return positions.map((p) => ({
      symbol: p.symbol,
      direction: p.direction as any,
      quantity: p.quantity,
      averageEntryPrice: p.averageEntryPrice,
      currentPrice: p.currentPrice,
      unrealizedPnl: p.unrealizedPnl,
      realizedPnl: p.realizedPnl ?? 0,
      liquidationPrice: p.liquidationPrice,
      leverage: p.leverage ?? 1,
      margin: p.margin ?? 0,
      updatedAt: p.updatedAt,
    } satisfies Position))
  }

  async getPosition(symbol: string): Promise<Position | null> {
    const pos = await this.broker.positions.getPosition(symbol)
    if (!pos) return null
    return {
      symbol: pos.symbol,
      direction: pos.direction as any,
      quantity: pos.quantity,
      averageEntryPrice: pos.averageEntryPrice,
      currentPrice: pos.currentPrice,
      unrealizedPnl: pos.unrealizedPnl,
      realizedPnl: pos.realizedPnl ?? 0,
      liquidationPrice: pos.liquidationPrice,
      leverage: pos.leverage ?? 1,
      margin: pos.margin ?? 0,
      updatedAt: pos.updatedAt,
    }
  }

  async getBalance(): Promise<{ totalEquity: number; balances: Record<string, { free: number; locked: number }>; unrealizedPnl: number; realizedPnl: number; mode: string }> {
    const info = await this.broker.account.getAccountInfo()
    const balances = await this.broker.account.getBalances()
    const mapped: Record<string, { free: number; locked: number }> = {}
    for (const [asset, bal] of Object.entries(balances)) {
      mapped[asset] = { free: bal.free, locked: bal.locked }
    }
    return {
      totalEquity: info.totalEquity ?? 0,
      balances: mapped,
      unrealizedPnl: info.unrealizedPnl ?? 0,
      realizedPnl: info.realizedPnl ?? 0,
      mode: ExecutionMode.Paper,
    }
  }

  // ── Events (passthrough to broker) ──

  on(event: string, listener: (...args: unknown[]) => void): void {
    this.broker.on?.(event, listener as any)
  }

  off(event: string, listener: (...args: unknown[]) => void): void {
    this.broker.off?.(event, listener as any)
  }

  // ── RiskContextSource ──

  getPositions(_strategyId: string): Map<string, RiskPosition> {
    return new Map() // Position data fetched asynchronously via broker API
  }

  getAccount(_strategyId: string): RiskAccount | undefined {
    const usdtBal = this.broker.paper.cashLedger.get('USDT')
    return {
      totalEquity: usdtBal?.total ?? 10_000,
      freeBalance: usdtBal?.free ?? 10_000,
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

  // ── Internal ──

  private toBrokerPlacementParams(request: OrderRequest): BrokerPlacementParams {
    return {
      symbol: request.symbol,
      side: request.side,
      type: request.type.toUpperCase(),
      quantity: request.quantity,
      price: request.price,
      stopPrice: request.stopPrice,
      timeInForce: request.timeInForce ?? 'GTC',
      reduceOnly: request.reduceOnly,
      clientOrderId: request.clientId,
    }
  }

  private toOrder(bo: BrokerOrder): Order {
    const orderStatusMap: Record<string, string> = {
      NEW: 'accepted',
      PARTIALLY_FILLED: 'partially_filled',
      FILLED: 'filled',
      CANCELLED: 'cancelled',
      REJECTED: 'rejected',
      EXPIRED: 'expired',
    }

    return {
      id: bo.brokerOrderId,
      strategyId: 'certification',
      symbol: bo.symbol,
      side: bo.side as 'buy' | 'sell',
      type: (bo.type?.toLowerCase() ?? 'market') as any,
      quantity: bo.quantity,
      price: bo.price,
      stopPrice: bo.stopPrice,
      timeInForce: (bo.timeInForce as any) ?? 'GTC',
      reduceOnly: bo.reduceOnly,
      status: orderStatusMap[bo.status] ?? bo.status?.toLowerCase() ?? 'pending',
      filledQuantity: bo.filledQuantity,
      averagePrice: bo.averagePrice,
      commission: bo.commission,
      commissionAsset: bo.commissionAsset,
      createdAt: bo.createdAt,
      updatedAt: bo.updatedAt,
    }
  }
}
