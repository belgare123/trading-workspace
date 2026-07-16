// ── types.ts — domain types for Chart Composition Engine ──
// @since 3.3.7

import type { PriceScaleOptions } from '../types'

/** A descriptor for one active pane — lightweight, no viewport */
export interface PaneState {
  readonly id: string
  readonly definitionId: string
  height: number           // ratio (0-1) of total chart height
  visible: boolean
}

/** Computed layout row per frame */
export interface PaneLayoutRow {
  paneId: string
  y: number                // pixel offset from canvas top
  height: number           // pixel height
}

/** Per-pane price scale config */
export interface PanePriceScale {
  paneId: string
  options: PriceScaleOptions
}

/** Crosshair state shared across panes */
export interface CrosshairState {
  pixelX: number
  pixelY: number          // Y in the pane that captured the crosshair
  timestamp: number
  price: number           // price in the pane that captured the crosshair
  visible: boolean
}
