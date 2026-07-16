// ── Condition types ──
// Core types for the Condition Engine.
//
// @since 3.4.4

import type { ExecutionContext } from '../context'
import type { SignalResult } from '../signals'

/** Rich condition result with score, reason, matched signals */
export interface ConditionResult {
  /** Whether the condition is satisfied */
  satisfied: boolean

  /** Condition strength (0–1), useful for ranking */
  score?: number

  /** Human-readable explanation of why the condition fired/didn't fire */
  reason?: string

  /** Signal IDs that contributed to this condition being satisfied */
  matchedSignals?: string[]
}

/** A node in the condition tree */
export interface ConditionNode {
  /** The ConditionDefinition id to evaluate */
  conditionId: string

  /** Parameters passed to the condition */
  params: Record<string, unknown>

  /** Children for composite conditions (AND/OR/NOT/XOR/Sequence) */
  children: ConditionNode[]

  /** Signal IDs this condition references (leaf conditions using signals) */
  signalIds?: string[]
}

/** Input for condition evaluation */
export interface ConditionInput {
  /** ExecutionContext (for contextual conditions) */
  ctx: ExecutionContext
  /** Pre-computed signal results by id */
  signalResults: Map<string, SignalResult>
  /** Pre-computed child condition results */
  childResults: ConditionResult[]
  /** Persisted state for this node (managed by runtime) */
  nodeState: Record<string, unknown>
  /** Resolved parameters */
  params: Record<string, unknown>
}

/** Condition parameter schema */
export interface ConditionParameter {
  id: string
  name: string
  type: 'number' | 'string' | 'boolean' | 'select'
  default: unknown
  description?: string
  options?: string[]
  min?: number
  max?: number
}
