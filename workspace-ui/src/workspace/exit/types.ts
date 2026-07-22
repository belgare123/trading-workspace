// ── Exit Engine: types & interfaces ──
// Sprint 5.5 — Exit Engine

import type { TradeContext, Trade } from '../trade'
import type { ExitDecision } from '../trade/runtime'

/**
 * ExitPolicy — single exit policy evaluating a trade context.
 * Returns null if no exit condition met.
 */
export interface ExitPolicy {
  readonly id: string
  evaluate(ctx: TradeContext): ExitDecision | null
}

/**
 * Policy priority ordering (lower = checked first).
 */
export const POLICY_PRIORITY = {
  EMERGENCY:  0,
  STOP_LOSS:  100,
  TRAILING:   200,
  TAKE_PROFIT: 300,
  TIME_EXIT:  400,
  SIGNAL:     999,
} as const

// ── Policy configs ──

export interface ROIThreshold {
  /** PnL% threshold, e.g. 0.01 = 1% */
  pct: number
  /** Quantity to exit: 'all' or absolute amount */
  amount: 'all' | number
}

export interface ROIPolicyConfig {
  thresholds: ROIThreshold[]
}

export type StopLossMode = 'fixed' | 'trailing' | 'atr' | 'price-level'

export interface StopLossPolicyConfig {
  mode: StopLossMode
  /** For fixed mode: e.g. -0.01 = -1% */
  value: number
  /** For price-level mode: absolute price */
  priceLevel?: number
  /** For ATR mode: multiplier, e.g. 2 = 2× ATR */
  atrMultiplier?: number
}

export interface TrailingPolicyConfig {
  /** PnL% to activate trailing, e.g. 0.01 = 1% */
  activationPct: number
  /** Distance from peak PnL%, e.g. 0.005 = 0.5% */
  distancePct: number
  /** Step to re-arm stop, e.g. 0.001 = 0.1% */
  stepPct: number
  /** Offset below peak, e.g. 0.001 = 0.1% */
  offsetPct: number
}

export interface EmergencyPolicyConfig {
  /** Max allowed drawdown % before emergency exit */
  maxDrawdownPct: number
  /** Max trade age in ms before time exit */
  maxTradeAgeMs: number
  /** Kill-switch triggers exit regardless of PnL */
  respectKillSwitch: boolean
}

/**
 * Full config for ExitEngine instantiation.
 */
export interface ExitEngineConfig {
  roi?: ROIPolicyConfig
  stopLoss?: StopLossPolicyConfig
  trailing?: TrailingPolicyConfig
  emergency?: EmergencyPolicyConfig
}

/** Helper: compute PnL% for a given trade */
export function computePnLPct(trade: Trade, currentPrice: number): number {
  const entry = trade.entry
  if (!entry || entry.quantity <= 0) return 0
  if (trade.direction === 'long') {
    return (currentPrice - entry.price) / entry.price
  }
  return (entry.price - currentPrice) / entry.price
}
