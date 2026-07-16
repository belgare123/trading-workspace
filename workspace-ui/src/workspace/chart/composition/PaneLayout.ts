// ── PaneLayout — computes vertical geometry for panes ──
// Given a total canvas height and a list of pane states with height ratios,
// returns per-pane LayoutRow (y-offset, pixel height).
// @since 3.3.7

import type { PaneState, PaneLayoutRow } from './types'

export class PaneLayout {
  /**
   * Compute per-pane y-offsets and pixel heights.
   * Normalises height ratios so they sum to 1.0, then applies DPR scaling.
   */
  compute(panes: PaneState[], canvasHeight: number, dpr: number): PaneLayoutRow[] {
    if (panes.length === 0) return []

    const visible = panes.filter(p => p.visible)
    if (visible.length === 0) return []

    // Normalise heights to sum = 1.0
    const totalRatio = visible.reduce((s, p) => s + p.height, 0)
    const norm = totalRatio > 0 ? 1 / totalRatio : 1

    const rows: PaneLayoutRow[] = []
    let y = 0
    const totalPx = canvasHeight * dpr

    for (const pane of visible) {
      const pxHeight = Math.round(totalPx * pane.height * norm)
      rows.push({ paneId: pane.id, y: Math.round(y), height: pxHeight })
      y += pxHeight
    }

    // Adjust last pane to fill any remaining pixels
    if (rows.length > 0) {
      const last = rows[rows.length - 1]
      const used = rows.reduce((s, r) => s + r.height, 0)
      last.height = Math.max(last.height, totalPx - used + last.height)
    }

    return rows
  }

  /**
   * Compute for CSS-space (divides by DPR after computing)
   */
  computeCss(panes: PaneState[], cssHeight: number): PaneLayoutRow[] {
    return this.compute(panes, cssHeight, 1)
  }
}
