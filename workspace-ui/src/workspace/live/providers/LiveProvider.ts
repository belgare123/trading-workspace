/**
 * LiveProvider.ts — Live trading provider
 *
 * IMPORTANT: This is the Sprint 4.1 stub. The full implementation
 * moved to LiveProvider in ../live/LiveProvider.ts (Sprint 4.5).
 * This stub remains for ExecutionGateway interface compatibility.
 *
 * LiveProvider delegates to a BrokerAdapter (Binance, Bybit, IBKR).
 * Strategy code is identical to PaperProvider — only this provider changes.
 *
 * @since 4.1 (stub) / 4.5 (full)
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

export class LiveProvider implements ExecutionGateway {
  readonly id = 'live-provider'
  readonly mode = ExecutionMode.Live

  private config: GatewayConfig | null = null
  private startTime = 0

  async connect(config: GatewayConfig): Promise<void> {
    this.config = config
    this.startTime = Date.now()
    console.log('[LiveProvider] Connected (live trading — stub)')
  }

  async disconnect(): Promise<void> {
    this.config = null
    console.log('[LiveProvider] Disconnected')
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

  // ── Stub implementations — full logic in Sprint 4.5 ──

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    return {
      accepted: true,
      orderId: request.id,
      message: '[STUB] Live order — full implementation in Sprint 4.5',
    }
  }

  async cancelOrder(_orderId: string): Promise<boolean> {
    return true
  }

  async replaceOrder(orderId: string, _request: Partial<OrderRequest>): Promise<OrderResult> {
    return {
      accepted: true,
      orderId,
      message: '[STUB] Live order replaced',
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
      totalEquity: 0,
      balances: {},
      unrealizedPnl: 0,
      realizedPnl: 0,
      mode: this.mode,
    }
  }

  on(_event: string, _listener: (...args: unknown[]) => void): void {
    // BrokerAdapter event subscription — Sprint 4.5
  }

  off(_event: string, _listener: (...args: unknown[]) => void): void {
    // BrokerAdapter event unsubscription — Sprint 4.5
  }
}
