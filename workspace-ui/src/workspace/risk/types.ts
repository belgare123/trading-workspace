/**
 * types.ts — Risk Runtime shared types
 *
 * @since 4.7
 */

import type { OrderRequest, TimeInForce, PositionDirection } from '../execution/types'

// ── Risk Decision ──

export type RiskDecisionStatus = 'allow' | 'modify' | 'reject'

export interface RiskViolation {
  ruleId: string
  ruleName: string
  severity: 'error' | 'warning' | 'info'
  message: string
  currentValue?: string | number
  limitValue?: string | number
}

export type RiskWarning = RiskViolation

export interface ModifiedOrderRequest {
  quantity?: number
  price?: number
  stopPrice?: number
  reduceOnly?: boolean
  timeInForce?: TimeInForce
}

export interface RiskDecision {
  status: RiskDecisionStatus
  order?: OrderRequest
  violations: RiskViolation[]
  warnings: RiskWarning[]
  score: number
  /** What changed in the order (only populated when status === 'modify') */
  modifications?: ModifiedOrderRequest
  /** Arbitrary metadata for audit/tracing */
  metadata?: Record<string, unknown>
}

// ── Risk Policy / Rule ──

export type RiskRuleSeverity = 'error' | 'warning' | 'info'

export interface RiskRuleConfig {
  id: string
  name: string
  description?: string
  severity: RiskRuleSeverity
  enabled: boolean
  params?: Record<string, unknown>
}

// ── Risk Context (passed into each rule evaluation) ──

export interface RiskContext {
  /** The order being evaluated */
  order: OrderRequest

  /** Current positions for the strategy */
  positions: Map<string, RiskPosition>

  /** Current account balance / equity */
  account?: RiskAccount

  /** Current market conditions snapshot */
  market?: MarketSnapshot

  /** Previous violations/warnings in this evaluation cycle */
  previousViolations: RiskViolation[]

  /** Runtime metadata (timestamp, environment, etc.) */
  meta: {
    now: number
    mode: 'simulation' | 'paper' | 'live'
    strategyId: string
  }
}

export interface RiskPosition {
  symbol: string
  direction: PositionDirection
  quantity: number
  averageEntryPrice: number
  currentPrice: number
  unrealizedPnl: number
  realizedPnl: number
  leverage: number
  liquidationPrice?: number
  marginUsed: number
}

export interface RiskAccount {
  totalEquity: number
  freeBalance: number
  usedMargin: number
  unrealizedPnl: number
  realizedPnl: number
  dailyPnl: number
  dailyTrades: number
  currency: string
}

export interface MarketSnapshot {
  prices: Map<string, number>
  volumes: Map<string, number>
  spreads: Map<string, number>
  timestamp: number
}

// ── Risk Report ──

export interface RiskReportEntry {
  timestamp: number
  strategyId: string
  orderId: string
  ruleId: string
  ruleName: string
  decision: RiskDecisionStatus
  violations: RiskViolation[]
  score: number
}

// ── Kill Switch ──

export interface KillSwitchState {
  active: boolean
  triggeredBy: string
  triggeredAt: number
  reason: string
  manualOverride?: boolean
  autoResetAt?: number
}
