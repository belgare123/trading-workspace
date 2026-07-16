// ── PriceScaleManager — per-pane price scale options ──
// Each pane has an independent price range. This manager creates and
// updates them as data changes.
// @since 3.3.7

import type { PriceScaleOptions } from '../types'

export class PriceScaleManager {
  private readonly _scales = new Map<string, PriceScaleOptions>()

  /** Get or create a price scale for a pane */
  get(paneId: string): PriceScaleOptions {
    let s = this._scales.get(paneId)
    if (!s) {
      s = {
        visible: true,
        position: 'right',
        inverted: false,
        logarithmic: false,
        fixedMin: 0,
        fixedMax: 100,
      }
      this._scales.set(paneId, s)
    }
    return s
  }

  /** Set a price range (adds 10% padding) */
  setRange(paneId: string, min: number, max: number): void {
    const padding = (max - min) * 0.1 || max * 0.1
    this.setFixed(paneId, min - padding, max + padding)
  }

  /** Set explicit min/max */
  setFixed(paneId: string, min: number, max: number): void {
    const s = this.get(paneId)
    s.fixedMin = min
    s.fixedMax = max
  }

  /** Remove a pane's scale */
  remove(paneId: string): void {
    this._scales.delete(paneId)
  }

  /** Clear all */
  clear(): void {
    this._scales.clear()
  }
}
