// ── SynchronizationRuntime — shared chart-wide sync service ──
// Owns the shared TimeScaleOptions reference and crosshair sync.
// Designed to be used across panes in a single chart, and eventually
// across multiple independent chart instances in a workspace.
// @since 3.3.7

import type { ViewportState, TimeScaleOptions } from '../types'
import { CrosshairSync } from './CrosshairSync'
import { PriceScaleManager } from './PriceScaleManager'

export class SynchronizationRuntime {
  /** Shared time scale — same object reference for all panes */
  readonly timeScale: TimeScaleOptions

  /** Shared viewport state (pan/zoom) */
  readonly viewport: ViewportState

  /** Crosshair synced across panes */
  readonly crosshair: CrosshairSync

  /** Per-pane price scale management */
  readonly priceScales: PriceScaleManager

  constructor(
    timeScale: TimeScaleOptions,
    viewport: ViewportState,
  ) {
    this.timeScale = timeScale
    this.viewport = viewport
    this.crosshair = new CrosshairSync()
    this.priceScales = new PriceScaleManager()
  }

  /** Create with default values */
  static createDefault(): SynchronizationRuntime {
    return new SynchronizationRuntime(
      { visible: true, rangeMs: 500 * 60_000, from: 0, to: 100 },
      { offsetX: 0, offsetY: 0, zoomX: 1, zoomY: 1 },
    )
  }

  /** Update the visible time range (all panes react automatically) */
  setTimeRange(from: number, to: number): void {
    this.timeScale.from = from
    this.timeScale.to = to
  }

  /** Reset crosshair position */
  hideCrosshair(): void {
    this.crosshair.hide()
  }

  /** Destroy */
  destroy(): void {
    this.crosshair.clear()
    this.priceScales.clear()
  }
}

export type { CrosshairSync }
export type { PriceScaleManager }
