// ── Wallet: types & interfaces ──
// Sprint 5.6 — WalletManager

import type { Trade } from '../trade/Trade'
import type { Direction } from '../trade/types'

// ════════════════════════════════════════
// Balance — single source of truth
// ════════════════════════════════════════

export interface Balance {
  /** Total cash equity (free + locked) */
  total: number
  /** Available for trading */
  free: number
  /** Locked in open orders */
  locked: number
  /** Used margin */
  marginUsed: number
  /** Unrealized PnL */
  unrealizedPnL: number
  /** Realized PnL */
  realizedPnL: number
  /** Account currency */
  currency: string
  /** Exchange timestamp (0 = unknown) */
  timestamp: number
}

// ════════════════════════════════════════
// WalletSnapshot — immutable projection
// ════════════════════════════════════════

export interface WalletSnapshot {
  total: number
  free: number
  locked: number
  marginUsed: number
  unrealizedPnL: number
  realizedPnL: number
  currency: string
  openPositionCount: number
  timestamp: number
}

// ════════════════════════════════════════
// Allocation types
// ════════════════════════════════════════

export interface AllocationRequest {
  strategyId: string
  symbol: string
  direction: Direction
  price: number
  stopLoss?: number
  takeProfit?: number
}

export interface AllocationResult {
  quantity: number
  notionalValue: number
  riskAmount: number
  riskPct: number
  pctOfEquity: number
  method: string
}

// ════════════════════════════════════════
// AllocationPolicy interface
// ════════════════════════════════════════

export interface AllocationPolicy {
  readonly id: string
  allocate(request: AllocationRequest, balance: Balance): AllocationResult
}

// ════════════════════════════════════════
// Allocator configs
// ════════════════════════════════════════

export interface FixedAmountConfig {
  type: 'fixed-amount'
  amount: number
}

export interface FixedPercentConfig {
  type: 'fixed-percent'
  /** 0.01 = 1% of equity per trade */
  percent: number
  maxLeverage?: number
}

export interface RiskPercentConfig {
  type: 'risk-percent'
  /** 0.01 = risk 1% of equity */
  riskPercent: number
  maxLeverage?: number
}

export interface KellyConfig {
  type: 'kelly'
  /** Kelly fraction (0.25 = quarter-Kelly for safety) */
  fraction: number
  /** Override winRate if available */
  winRate?: number
  /** Override avgRiskReward if available */
  avgRiskReward?: number
}

export type AllocatorConfig = FixedAmountConfig | FixedPercentConfig | RiskPercentConfig | KellyConfig

// ════════════════════════════════════════
// IWalletManager — интерфейс для TradeLifecycleRuntime
// ════════════════════════════════════════

export interface IWalletManager {
  /** Get current balance snapshot */
  getBalance(): Balance
  /** Get wallet snapshot for TradeContext */
  getSnapshot(): WalletSnapshot
  /** Calculate position size for a signal */
  allocate(request: AllocationRequest): AllocationResult
  /** Lock funds for an open order */
  reserve(amount: number, orderId: string): void
  /** Release locked funds (cancel/reject) */
  release(orderId: string): void
  /** Settle PnL after trade close */
  commit(trade: Trade): void
  /** Sync balance from exchange */
  sync(balance: Balance): void
  /** Subscribe to wallet events */
  on(eventType: string, handler: WalletEventHandler): () => void
  /** Shutdown */
  shutdown(): void
}

// ════════════════════════════════════════
// Wallet events
// ════════════════════════════════════════

export const WalletEventType = {
  /** Balance updated (sync or internal) */
  BalanceUpdated: 'wallet:balance-updated',
  /** Equity changed */
  EquityChanged: 'wallet:equity-changed',
  /** Funds allocated for a trade */
  Allocated: 'wallet:allocated',
  /** Funds reserved for an order */
  Reserved: 'wallet:reserved',
  /** Reserved funds released */
  Released: 'wallet:released',
  /** PnL committed after trade close */
  Committed: 'wallet:committed',
  /** Margin updated */
  MarginUpdated: 'wallet:margin-updated',
} as const

export type WalletEventType = (typeof WalletEventType)[keyof typeof WalletEventType]

export type WalletEvent =
  | { type: typeof WalletEventType.BalanceUpdated; balance: Balance; timestamp: number }
  | { type: typeof WalletEventType.EquityChanged; total: number; delta: number; timestamp: number }
  | { type: typeof WalletEventType.Allocated; result: AllocationResult; timestamp: number }
  | { type: typeof WalletEventType.Reserved; amount: number; orderId: string; timestamp: number }
  | { type: typeof WalletEventType.Released; amount: number; orderId: string; timestamp: number }
  | { type: typeof WalletEventType.Committed; tradeId: string; realizedPnL: number; timestamp: number }
  | { type: typeof WalletEventType.MarginUpdated; marginUsed: number; timestamp: number }

export type WalletEventHandler = (event: WalletEvent) => void

// ════════════════════════════════════════
// WalletSynchronizer config
// ════════════════════════════════════════

export interface WalletSynchronizerConfig {
  /** Poll interval in ms */
  pollIntervalMs: number
  /** Max retries on sync failure */
  maxRetries: number
}
