// ── PaneDefinition — contract for a chart pane type ──
// Describes what a pane contains and how to configure defaults.
// @since 3.3.7

import type { PaneState } from './types'

export interface PaneDefinition {
  readonly id: string
  readonly name: string
  readonly defaultHeight: number           // ratio (0-1) of total height
  readonly minHeight: number               // min ratio
  readonly hasCandles: boolean
  readonly hasGrid: boolean
  readonly hasAxes: boolean
  readonly hasCrosshair: boolean
  /** Indicator definition IDs that belong in this pane */
  readonly indicatorIds: readonly string[]
  /** Whether this pane hosts drawings */
  readonly hasDrawings: boolean
  /** Whether this pane hosts overlays */
  readonly hasOverlays: boolean
  /** Called when the pane is first created */
  onCreate?(): Partial<PaneState>
}
