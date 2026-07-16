/**
 * BrokerAdapter.ts — Unified broker interface
 *
 * Every exchange adapter implements this interface.
 * LiveProvider never knows which exchange it's talking to.
 *
 * @since 4.5
 */

import type {
  BrokerAccountInfo,
  BrokerBalance,
  BrokerOrderStatus,
  BrokerPositionInfo,
  BrokerEvent,
} from './types'
import type { BrokerCapabilities } from './BrokerCapabilities'

export type BrokerEventHandler = (event: BrokerEvent) => void

export interface BrokerAdapter {
  /** Unique identifier */
  readonly id: string

  /** Human-readable name */
  readonly name: string

  /** Feature capabilities */
  readonly capabilities: BrokerCapabilities

  // ── Connection Lifecycle ──

  connect(apiKey: string, apiSecret: string, testnet?: boolean): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean

  // ── Order Management ──

  placeOrder(params: {
    symbol: string
    side: 'buy' | 'sell'
    type: string
    quantity: number
    price?: number
    stopPrice?: number
    timeInForce?: string
    reduceOnly?: boolean
    clientOrderId?: string
  }): Promise<BrokerOrderStatus>

  cancelOrder(orderId: string): Promise<boolean>
  cancelAllOrders(symbol?: string): Promise<number>

  replaceOrder(orderId: string, params: {
    quantity?: number
    price?: number
    stopPrice?: number
  }): Promise<BrokerOrderStatus>

  getOrder(orderId: string): Promise<BrokerOrderStatus | null>
  getOpenOrders(symbol?: string): Promise<BrokerOrderStatus[]>
  getOrderHistory(symbol: string, limit?: number): Promise<BrokerOrderStatus[]>

  // ── Account ──

  getBalances(): Promise<Record<string, BrokerBalance>>
  getAccountInfo(): Promise<BrokerAccountInfo>

  // ── Positions ──

  getPositions(symbol?: string): Promise<BrokerPositionInfo[]>
  getPosition(symbol: string): Promise<BrokerPositionInfo | null>

  // ── Event Subscriptions ──

  /** Subscribe to broker events (fills, order updates, positions) */
  on(event: string, handler: BrokerEventHandler): () => void
  /** Remove an event listener */
  off(event: string, handler: BrokerEventHandler): void

  // ── Lifecycle ──

  /** Clean up all subscriptions */
  dispose(): Promise<void>
}
