// ── SignalDefinition — pure, stateless signal contract ──
//
// A signal is a pure function that receives ExecutionContext
// and returns SignalResult. It has no state, no subscriptions,
// no knowledge of StrategyRuntime.
//
// Evaluate is async because ExecutionContext methods (market,
// indicators, orders) return Promises. The SignalRuntime
// handles caching so signals are evaluated once per bar.
//
// This makes every signal fully reusable across:
//   - Strategy Studio (signals inside strategies)
//   - Backtest Engine (evaluate on historical bars)
//   - Dashboard (display signal states without running strategies)
//   - Condition Engine (compose signals with logical operators)
//
// @since 3.4.3

import type { SignalResult, SignalParameter } from '../types'
import type { ExecutionContext } from '../../context'

export interface SignalDefinition {
  /** Unique signal id (e.g. 'cross-above', 'rsi-overbought') */
  readonly id: string

  /** Human-readable name */
  readonly name: string

  /** Semantic version */
  readonly version: string

  /** Brief description */
  readonly description?: string

  /** Parameter schema */
  readonly parameters?: SignalParameter[]

  /**
   * Evaluate the signal against current ExecutionContext.
   * Pure function — no side effects, no state mutations.
   * Async because ExecutionContext methods return Promises.
   */
  evaluate(ctx: ExecutionContext, params: Record<string, unknown>): Promise<SignalResult>
}
