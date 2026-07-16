// ── DrawingDefinition — contract for a drawable tool type ──
// Analogous to IndicatorDefinition in the Indicator Engine.
// Each drawing type (line, rectangle, fib, text) registers one of these.

import type { DrawingCategory, DrawingRenderContext, DrawingStyle, Anchor } from './types'
import type { DrawingInstance } from './DrawingInstance'

export type { DrawingRenderContext } from './types'
export type { DrawingInstance } from './DrawingInstance'

export interface DrawingDefinition {
  /** Unique identifier (e.g. 'trend-line', 'fib-retracement') */
  readonly id: string

  /** Human-readable name (e.g. 'Trend Line', 'Fibonacci Retracement') */
  readonly name: string

  /** Visual category for toolbar grouping */
  readonly category: DrawingCategory

  /** Default visual style (cloned per-instance) */
  readonly defaultStyle: DrawingStyle

  /**
   * Create a new instance with the given anchor.
   * Multi-anchor tools (trend line, rectangle, fib) start with one anchor;
   * the second is added at a sensible default offset.
   */
  create(anchor: Anchor): DrawingInstance

  /** Render the instance onto the canvas via the render context */
  render(ctx: DrawingRenderContext, instance: DrawingInstance): void
}
