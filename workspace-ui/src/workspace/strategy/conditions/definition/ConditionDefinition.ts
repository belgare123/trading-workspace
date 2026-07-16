// ── ConditionDefinition — condition contract ──
//
// A condition evaluates SignalResults and/or ExecutionContext
// to determine if a strategy's requirements are met.
//
// Three levels of conditions:
//   1. Logical — AND, OR, NOT, XOR (composite over child results)
//   2. Temporal — Sequence, Cooldown, TimeWindow (time-aware)
//   3. Contextual — PositionState, Drawdown (use ExecutionContext)
//
// Each evaluate receives:
//   - ctx: ExecutionContext for contextual data
//   - signalResults: all pre-computed signal results for this bar
//   - childResults: pre-computed child condition results (for composite)
//   - nodeState: persisted state between ticks (for temporal)
//   - params: resolved parameter values
//
// Returns ConditionResult + next nodeState.
//
// @since 3.4.4

import type { ConditionInput, ConditionResult, ConditionParameter } from '../types'

// Re-export types used by builtins
export type { ConditionInput, ConditionResult, ConditionParameter }

export interface ConditionEvaluationOutput {
  result: ConditionResult
  nextState: Record<string, unknown>
}

export interface ConditionDefinition {
  /** Unique condition id (e.g. 'and', 'cooldown', 'position-open') */
  readonly id: string

  /** Human-readable name */
  readonly name: string

  /** Semantic version */
  readonly version: string

  /** Brief description */
  readonly description?: string

  /** Parameter schema */
  readonly parameters?: ConditionParameter[]

  /**
   * Evaluate the condition.
   * Pure function — no side effects, no state mutations.
   * Returns result + updated node state (for temporal conditions).
   */
  evaluate(input: ConditionInput): Promise<ConditionEvaluationOutput>
}
