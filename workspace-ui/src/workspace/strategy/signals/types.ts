// ── Signal types ──
// Core types for the Signal Engine.
//
// @since 3.4.3

import type { ExecutionContext } from '../context'

/** Parameters passed to signal.evaluate() — ExecutionContext + resolved params */
export interface SignalEvaluationContext {
  ctx: ExecutionContext
  params: Record<string, unknown>
}

/** Rich signal result with optional strength/confidence/metadata */
export interface SignalResult {
  /** Whether the signal is active/firing */
  active: boolean

  /** Signal strength (0–1), useful for ranking and visualisation */
  strength?: number

  /** Confidence level (0–1), useful for ML-based signals */
  confidence?: number

  /** Human-readable explanation or metadata */
  metadata?: Record<string, unknown>
}

/** Signal parameter schema */
export interface SignalParameter {
  id: string
  name: string
  type: 'number' | 'string' | 'boolean' | 'select'
  default: unknown
  description?: string
  options?: string[]  // for 'select' type
  min?: number        // for 'number' type
  max?: number        // for 'number' type
}
