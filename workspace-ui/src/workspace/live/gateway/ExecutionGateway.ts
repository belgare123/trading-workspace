/**
 * ExecutionGateway.ts — Core gateway interface for all execution modes
 *
 * The ExecutionGateway is the single point of entry for order execution.
 * Strategy never knows which mode it's running in (simulation/paper/live).
 *
 * @since 4.1
 */

import type {
  OrderRequest,
  Order,
  Position,
  Fill,
} from '../../execution/types'
import type { ExecutionMode } from './ExecutionMode'

// ── Gateway Config ──

export interface GatewayConfig {
  mode: ExecutionMode
  /** Virtual starting balance (paper only) */
  initialBalance?: Record<string, number>
  /** Broker credentials (live only) */
  credentials?: Record<string, string>
  /** Commission model config */
  commission?: {
    maker: number
    taker: number
    asset: string
  }
  /** Slippage model config */
  slippage?: {
    type: 'fixed' | 'percentage'
    value: number
  }
}

// ── Account Info ──

export interface AccountInfo {
  /** Total account equity in quote currency */
  totalEquity: number
  /** Free balance per asset */
  balances: Record<string, { free: number; locked: number }>
  /** Unrealized PnL */
  unrealizedPnl: number
  /** Realized PnL */
  realizedPnl: number
  /** Current execution mode */
  mode: ExecutionMode
}

// ── Gateway Status ──

export interface GatewayStatus {
  connected: boolean
  mode: ExecutionMode
  uptime: number // seconds since connect
  activeOrders: number
  openPositions: number
  /** Error if any */
  error?: string
}

// ── Order Result ──

export interface OrderResult {
  accepted: boolean
  orderId: string
  message?: string
  fills?: Fill[]
}

// ── Execution Gateway Interface ──

export interface ExecutionGateway {
  /** Unique identifier for this gateway instance */
  readonly id: string
  /** The execution mode this gateway implements */
  readonly mode: ExecutionMode

  // ── Lifecycle ──

  connect(config: GatewayConfig): Promise<void>
  disconnect(): Promise<void>
  getStatus(): GatewayStatus

  // ── Orders ──

  placeOrder(request: OrderRequest): Promise<OrderResult>
  cancelOrder(orderId: string): Promise<boolean>
  replaceOrder(orderId: string, request: Partial<OrderRequest>): Promise<OrderResult>

  // ── Query ──

  getOrders(filter?: {
    symbol?: string
    status?: string
    limit?: number
  }): Promise<Order[]>

  getPositions(): Promise<Position[]>
  getPosition(symbol: string): Promise<Position | null>
  getBalance(): Promise<AccountInfo>

  // ── Events ──
  // Event types: 'order:placed' | 'order:filled' | 'order:rejected'
  //              | 'position:opened' | 'position:closed' | 'error'

  on(event: string, listener: (...args: unknown[]) => void): void
  off(event: string, listener: (...args: unknown[]) => void): void
}
