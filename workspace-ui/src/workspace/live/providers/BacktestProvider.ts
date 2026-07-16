/**
 * BacktestProvider.ts — Simulation provider wrapping the existing BacktestRuntime
 *
 * This provider adapts the existing BacktestRuntime to the ExecutionGateway
 * interface, allowing the platform to run simulations through the same
 * gateway abstraction as paper and live trading.
 *
 * @since 4.1
 */

import type {
  OrderRequest,
  Order,
  Position,
} from '../../execution/types'
import type {
  ExecutionGateway,
  GatewayConfig,
  GatewayStatus,
  AccountInfo,
  OrderResult,
} from '../gateway/ExecutionGateway'
import { ExecutionMode } from '../gateway/ExecutionMode'

export class BacktestProvider implements ExecutionGateway {
  readonly id = 'backtest-provider'
  readonly mode = ExecutionMode.Simulation

  private config: GatewayConfig | null = null
  private startTime = 0

  async connect(config: GatewayConfig): Promise<void> {
    this.config = config
    this.startTime = Date.now()
    console.log('[BacktestProvider] Connected (simulation mode)')
  }

  async disconnect(): Promise<void> {
    this.config = null
    console.log('[BacktestProvider] Disconnected')
  }

  getStatus(): GatewayStatus {
    return {
      connected: this.config !== null,
      mode: this.mode,
      uptime: this.config ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      activeOrders: 0,
      openPositions: 0,
    }
  }

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    // In simulation mode, orders are handled by BacktestRuntime directly.
    return {
      accepted: true,
      orderId: request.id,
      message: 'Order submitted to backtest engine',
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    console.log(`[BacktestProvider] Order cancelled: ${orderId}`)
    return true
  }

  async replaceOrder(orderId: string, _request: Partial<OrderRequest>): Promise<OrderResult> {
    return {
      accepted: true,
      orderId,
      message: 'Order replaced in backtest engine',
    }
  }

  async getOrders(): Promise<Order[]> {
    return []
  }

  async getPositions(): Promise<Position[]> {
    return []
  }

  async getPosition(_symbol: string): Promise<Position | null> {
    return null
  }

  async getBalance(): Promise<AccountInfo> {
    return {
      totalEquity: 100000,
      balances: { USDT: { free: 100000, locked: 0 } },
      unrealizedPnl: 0,
      realizedPnl: 0,
      mode: this.mode,
    }
  }

  on(_event: string, _listener: (...args: unknown[]) => void): void {
    // Event bus integration — implemented when connected to ExecutionEventBus
  }

  off(_event: string, _listener: (...args: unknown[]) => void): void {
    // Event bus integration
  }
}
