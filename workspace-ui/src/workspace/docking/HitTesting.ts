/**
 * HitTesting — determines which panel / edge / zone the pointer is over
 *
 * Strategy:
 *   1. For each panel, calculate pixel bounds from normalized positions
 *   2. Check if pointer is inside the panel (reverse z-order: last = topmost)
 *   3. If inside, determine zone by EXPLICIT priority:
 *        Left > Right > Top > Bottom > Center
 *      No ambiguity — first matching edge wins.
 *   4. For very small panels (< 150px), a minimum pixel threshold is applied
 *      so edge zones remain usable.
 *
 * @since 3.2.3
 */

import type { Panel } from '../layout/types'
import type { DockTarget, DockZone } from './types'

export interface HitTestOptions {
  /** Edge zone threshold ratio (default 0.15 = 15%) */
  edgeThreshold?: number
  /** Minimum pixel threshold for edge zones on small panels (default 20) */
  minPixelThreshold?: number
}

/** Computed panel bounds in pixels */
export interface PanelBounds {
  id: string
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

/** Convert normalized panel positions to pixel bounds */
export function computePanelBounds(panels: Panel[], containerWidth: number, containerHeight: number): PanelBounds[] {
  return panels.map(p => ({
    id: p.id,
    left: p.position.x * containerWidth,
    top: p.position.y * containerHeight,
    right: (p.position.x + p.position.width) * containerWidth,
    bottom: (p.position.y + p.position.height) * containerHeight,
    width: p.position.width * containerWidth,
    height: p.position.height * containerHeight,
  }))
}

/**
 * Hit test: given pointer position and panel bounds, determine the dock target.
 *
 * Checks panels in reverse z-order (last = topmost). Returns the first
 * matching panel and zone, or null if no panel is hit.
 */
export function hitTest(
  pointerX: number,
  pointerY: number,
  bounds: PanelBounds[],
  opts?: HitTestOptions,
): DockTarget | null {
  const threshold = opts?.edgeThreshold ?? 0.15
  const minPx = opts?.minPixelThreshold ?? 20

  // Check from top to bottom (last panels overlap first)
  for (let i = bounds.length - 1; i >= 0; i--) {
    const b = bounds[i]

    if (pointerX < b.left || pointerX > b.right || pointerY < b.top || pointerY > b.bottom) {
      continue
    }

    // Determine zone with EXPLICIT priority
    const relX = (pointerX - b.left) / b.width
    const relY = (pointerY - b.top) / b.height

    const zone = determineZone(relX, relY, threshold, b.width, b.height, minPx)
    return { panelId: b.id, zone }
  }

  return null
}

/**
 * Determine dock zone from relative position within a panel.
 *
 * EXPLICIT priority (first match wins):
 *   1. Left   — cursor is within left edge threshold
 *   2. Right  — cursor is within right edge threshold
 *   3. Top    — cursor is within top edge threshold
 *   4. Bottom — cursor is within bottom edge threshold
 *   5. Center — tab docking
 *
 * Edge threshold is the larger of (ratio * dimension) and minPixelThreshold,
 * so tiny panels still have usable edge zones.
 */
function determineZone(
  relX: number,
  relY: number,
  ratioThreshold: number,
  panelWidth: number,
  panelHeight: number,
  minPx: number,
): DockZone {
  // Use relative values (normalized) for comparison.
  // For small panels, the threshold is the larger of ratio-based and
  // minimum-pixel-based so edge zones remain usable on tiny panels.
  const relThreshold = Math.max(ratioThreshold, minPx / Math.min(panelWidth, panelHeight))

  // ── EXPLICIT PRIORITY: Left → Right → Top → Bottom → Center ──
  // Each zone is checked independently. First match wins.
  // This eliminates ambiguity — corners and overlapping zones are resolved
  // purely by priority order.

  if (relX <= relThreshold) return 'left'
  if (relX >= 1 - relThreshold) return 'right'
  if (relY <= relThreshold) return 'top'
  if (relY >= 1 - relThreshold) return 'bottom'

  // No edge hit → tab docking
  return 'center'
}
