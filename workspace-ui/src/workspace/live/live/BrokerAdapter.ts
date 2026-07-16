/**
 * BrokerAdapter.ts — Split broker interface (Connection / Order / Position / Account / MarketData)
 *
 * Every exchange adapter implements these sub-interfaces.
 * LiveProvider composes them and never knows which exchange it's talking to.
 *
 * @since 4.6
 */

import type {
  BrokerPlacementParams,
  BrokerOrder,
  BrokerPosition,
  BrokerBalance,
  BrokerAccountInfo,
  BrokerFill,
  BrokerEvent,
} from './types'
import type { BrokerCapabilities } from './BrokerCapabilities'

// ── Connection Lifecycle ──

export interface ConnectionAdapter {
  connect(apiKey: string, apiSecret: string, testnet?: boolean): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean

  /** Optional: fetch exchange server time for clock synchronization */
  getServerTime?(): Promise<number>
}

// ── Order Management ──

export interface OrderAdapter {
  placeOrder(params: BrokerPlacementParams): Promise<BrokerOrder>
  cancelOrder(orderId: string): Promise<boolean>
  cancelAllOrders(symbol?: string): Promise<number>
  replaceOrder(orderId: string, params: Partial<BrokerPlacementParams>): Promise<BrokerOrder>
  getOrder(orderId: string): Promise<BrokerOrder | null>
  getOpenOrders(symbol?: string): Promise<BrokerOrder[]>
  getOrderHistory(symbol: string, limit?: number): Promise<BrokerOrder[]>

  /** Subscribe to order updates. Returns unsubscribe function. */
  subscribeOrders(handler: (order: BrokerOrder) => void): () => void
  /** Subscribe to fill events */
  subscribeFills(handler: (fill: BrokerFill) => void): () => void
}

// ── Position Management ──

export interface PositionAdapter {
  getPositions(symbol?: string): Promise<BrokerPosition[]>
  getPosition(symbol: string): Promise<BrokerPosition | null>

  /** Subscribe to position updates */
  subscribePositions(handler: (position: BrokerPosition) => void): () => void
}

// ── Account ──

export interface AccountAdapter {
  getBalances(): Promise<Record<string, BrokerBalance>>
  getAccountInfo(): Promise<BrokerAccountInfo>

  /** Subscribe to balance updates */
  subscribeBalances(handler: (balances: Record<string, BrokerBalance>) => void): () => void
}

// ── Order Book & Ticker (optional — separate channel from execution) ──

export interface MarketDataAdapter {
  getTicker(symbol: string): Promise<{ bid: number; ask: number; last: number; volume: number; timestamp: number }>
  getOrderBook(symbol: string, limit?: number): Promise<{ bids: [number, number][]; asks: [number, number][] }>
  subscribeTicker(symbol: string, handler: (ticker: { bid: number; ask: number; last: number; volume: number; timestamp: number }) => void): () => void
  subscribeOrderBook(symbol: string, handler: (book: { bids: [number, number][]; asks: [number, number][] }) => void): () => void
}

// ── Composite BrokerAdapter ──

export interface BrokerAdapter {
  /** Unique identifier */
  readonly id: string

  /** Human-readable name */
  readonly name: string

  /** Feature capabilities */
  readonly capabilities: BrokerCapabilities

  /** Connection lifecycle */
  connection: ConnectionAdapter

  /** Order management */
  orders: OrderAdapter

  /** Position management */
  positions: PositionAdapter

  /** Account / balance management */
  account: AccountAdapter

  /** Market data (optional — use LiveFeedRuntime when possible) */
  marketData?: MarketDataAdapter

  /** Legacy generic event handler (used by BrokerEventAdapter bridge) */
  on?(event: string, handler: (event: BrokerEvent) => void): () => void
  off?(event: string, handler: (event: BrokerEvent) => void): void

  /** Clean up all subscriptions */
  dispose(): Promise<void>
}
