/**
 * types.ts — Live Provider shared types
 *
 * Connection state machine, configuration, and unified broker models.
 * NO exchange-specific DTOs escape the adapter boundary.
 *
 * @since 4.5
 */

// ═══════════════════════════════════════════
// Connection States
// ═══════════════════════════════════════════

export const ConnectionStates = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DEGRADED: 'degraded',
  AUTHENTICATION_FAILED: 'authentication_failed',
  RATE_LIMITED: 'rate_limited',
} as const

export type ConnectionState = (typeof ConnectionStates)[keyof typeof ConnectionStates]

/** State machine transitions */
const TRANSITIONS: Record<ConnectionState, ConnectionState[]> = {
  disconnected: ['connecting'],
  connecting: ['connected', 'authentication_failed', 'disconnected'],
  connected: ['reconnecting', 'degraded', 'disconnected'],
  reconnecting: ['connected', 'authentication_failed', 'disconnected', 'rate_limited'],
  degraded: ['connected', 'reconnecting', 'disconnected'],
  authentication_failed: ['disconnected', 'connecting'],
  rate_limited: ['reconnecting', 'disconnected'],
}

export function canTransition(from: ConnectionState, to: ConnectionState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

// ═══════════════════════════════════════════
// Live Provider Configuration
// ═══════════════════════════════════════════

export interface LiveProviderConfig {
  /** Broker adapter identifier (e.g. 'binance-spot', 'bybit-futures') */
  brokerId: string
  /** API credentials (handled by broker adapter, not stored here) */
  apiKey?: string
  apiSecret?: string
  /** Connection settings */
  reconnectDelayMs?: number
  maxReconnectAttempts?: number
  /** Sync intervals (ms) */
  positionSyncIntervalMs?: number
  accountSyncIntervalMs?: number
  orderSyncIntervalMs?: number
  /** Symbol whitelist */
  symbols?: string[]
}

export const DEFAULT_LIVE_CONFIG: Partial<LiveProviderConfig> = {
  reconnectDelayMs: 5_000,
  maxReconnectAttempts: 10,
  positionSyncIntervalMs: 5_000,
  accountSyncIntervalMs: 10_000,
  orderSyncIntervalMs: 5_000,
}

// ═══════════════════════════════════════════
// Unified Broker Models
// ═══════════════════════════════════════════
//
// These are the canonical representations used across the platform.
// Every BrokerAdapter MUST convert exchange DTOs to these shapes.
// NO exchange-specific types escape the adapter boundary.

/** Order placement parameters sent to broker */
export interface BrokerPlacementParams {
  symbol: string
  side: 'buy' | 'sell'
  type: string
  quantity: number
  price?: number
  stopPrice?: number
  timeInForce?: string
  reduceOnly?: boolean
  clientOrderId?: string
  postOnly?: boolean
}

/** Unified order model */
export interface BrokerOrder {
  brokerOrderId: string
  clientOrderId?: string
  symbol: string
  side: 'buy' | 'sell'
  type: string
  status: string
  quantity: number
  filledQuantity: number
  price?: number
  stopPrice?: number
  averagePrice: number
  commission: number
  commissionAsset?: string
  timeInForce?: string
  reduceOnly?: boolean
  createdAt: number
  updatedAt: number
}

/** Unified position model */
export interface BrokerPosition {
  symbol: string
  direction: 'long' | 'short'
  quantity: number
  averageEntryPrice: number
  currentPrice: number
  unrealizedPnl: number
  realizedPnl: number
  liquidationPrice?: number
  margin?: number
  leverage?: number
  updatedAt: number
}

/** Unified balance model */
export interface BrokerBalance {
  asset: string
  free: number
  locked: number
  total: number
}

/** Unified account info */
export interface BrokerAccountInfo {
  balances: Record<string, BrokerBalance>
  totalEquity: number
  unrealizedPnl: number
  marginLevel?: number
  canTrade: boolean
  isTestnet?: boolean
}

/** Unified fill model */
export interface BrokerFill {
  id: string
  orderId: string
  brokerOrderId: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  commission: number
  commissionAsset?: string
  realizedPnl?: number
  timestamp: number
}

/** Full trade record (fill with extra metadata) */
export interface BrokerTrade extends BrokerFill {
  tradeId: string
  isBuyer: boolean
  isMaker: boolean
}

/** Generic broker event for subscription callbacks */
export interface BrokerEvent {
  type: string
  symbol?: string
  data: unknown
  timestamp: number
}

// ═══════════════════════════════════════════
// Deprecated — renamed to BrokerOrder/BrokerPosition
// ═══════════════════════════════════════════
/** @deprecated Use BrokerOrder */
export type BrokerOrderStatus = BrokerOrder
/** @deprecated Use BrokerPosition */
export type BrokerPositionInfo = BrokerPosition
