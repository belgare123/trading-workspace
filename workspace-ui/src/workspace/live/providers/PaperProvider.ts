/**
 * PaperProvider.ts — Paper trading provider (Dry Run)
 *
 * IMPORTANT: This is a STUB for Sprint 4.1.
 * Full implementation in Sprint 4.3 — Paper Trading.
 *
 * PaperProvider simulates:
 * - Virtual balance
 * - Real prices from LiveFeed
 * - Virtual orders with fills, commissions, slippage
 * - Stops, take-profits
 * - Trade journal
 *
 * @since 4.1 (stub) / 4.3 (full)
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

export class PaperProvider implements ExecutionGateway {
  readonly id = 'paper-provider'
  readonly mode = ExecutionMode.Paper

  private config: GatewayConfig | null = null
  private startTime = 0

  async connect(config: GatewayConfig): Promise<void> {
    this.config = config
    this.startTime = Date.now()
    console.log('[PaperProvider] Connected (paper trading — stub)')
  }

  async disconnect(): Promise<void> {
    this.config = null
    console.log('[PaperProvider] Disconnected')
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

  // ── Stub implementations — full logic in Sprint 4.3 ──

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    return {
      accepted: true,
      orderId: request.id,
      message: '[STUB] Paper order — full implementation in Sprint 4.3',
    }
  }

  async cancelOrder(_orderId: string): Promise<boolean> {
    return true
  }

  async replaceOrder(orderId: string, _request: Partial<OrderRequest>): Promise<OrderResult> {
    return {
      accepted: true,
      orderId,
      message: '[STUB] Paper order replaced',
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
    const initialBalance = this.config?.initialBalance?.USDT ?? 10000
    return {
      totalEquity: initialBalance,
      balances: { USDT: { free: initialBalance, locked: 0 } },
      unrealizedPnl: 0,
      realizedPnl: 0,
      mode: this.mode,
    }
  }

  on(_event: string, _listener: (...args: unknown[]) => void): void {
    // Event bus — Sprint 4.3
  }

  off(_event: string, _listener: (...args: unknown[]) => void): void {
    // Event bus — Sprint 4.3
  }
}
