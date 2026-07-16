// ── StrategyDefinition — contract for a trading strategy ──
// Each strategy (MovingAverageCross, RsiReversal, etc.)
// implements this interface and registers with StrategyRegistry.
//
// The definition is a factory — it describes HOW to create a
// strategy instance and what parameters it accepts. Actual
// execution state lives in StrategyRuntime.
//
// Strategy never imports Runtime — it only receives
// ExecutionContext as its sole external dependency.
//
// @since 3.4.1

import type { StrategySignal } from '../types'
import type { ExecutionContext } from '../context'

export interface StrategyBar {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

export interface StrategyContextBar {
  /** Current market bar (candle) */
  readonly bar: StrategyBar
  /** Historical bars available to the strategy */
  readonly bars: readonly StrategyBar[]
  /** Current timestamp */
  readonly timestamp: number
}

export interface StrategyDefinition {
  /** Unique definition id (e.g. 'ma-cross', 'rsi-reversal') */
  readonly id: string

  /** Human-readable name */
  readonly name: string

  /** Semantic version */
  readonly version: string

  /** Brief description */
  readonly description?: string

  /** Author */
  readonly author?: string

  /** Parameter schema */
  readonly parameters?: Record<string, ParameterSchema>

  /** Default parameter values */
  readonly defaultParameters?: Record<string, unknown>

  /**
   * Create a new strategy instance.
   * Called once when the strategy is added to runtime.
   * Receives ExecutionContext for any initialisation logic.
   * Returns initial state.
   */
  create(ctx: ExecutionContext, params?: Record<string, unknown>): Record<string, unknown>

  /**
   * Called on every new bar.
   * Receives current bar context + ExecutionContext.
   * Returns signals (buy/sell/close) or null.
   */
  onBar(context: StrategyContextBar, ctx: ExecutionContext): StrategySignal | null
}

export interface ParameterSchema {
  type: 'number' | 'string' | 'boolean' | 'select'
  label: string
  default?: unknown
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: string }[]
  description?: string
}
