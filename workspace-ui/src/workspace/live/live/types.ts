/**
 * types.ts — Live Provider shared types
 *
 * Connection state machine, configuration, and broker-side types.
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
// Broker-side types
// ═══════════════════════════════════════════

export interface BrokerBalance {
  asset: string
  free: number
  locked: number
  total: number
}

export interface BrokerAccountInfo {
  balances: Record<string, BrokerBalance>
  totalEquity: number
  unrealizedPnl: number
  marginLevel?: number
  canTrade: boolean
  isTestnet?: boolean
}

export interface BrokerOrderStatus {
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
  createdAt: number
  updatedAt: number
}

export interface BrokerPositionInfo {
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
}

export interface BrokerEvent {
  type: string
  symbol?: string
  data: unknown
  timestamp: number
}
