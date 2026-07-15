/**
 * HitTesting — determines which panel / edge / zone the pointer is over
 *
 * Strategy:
 *   1. For each panel, calculate pixel bounds from normalized positions
 *   2. Check if pointer is inside the panel
 *   3. If inside, determine zone by proximity to edges:
 *      - Left/right/top/bottom edge (within 15%) → split zone
 *      - Center → tab docking
 *
 * @since 3.2.3
 */

import type { Panel } from '../layout/types'
import type { DockTarget, DockZone } from './types'

export interface HitTestOptions {
  /** Edge zone threshold ratio (default 0.15 = 15%) */
  edgeThreshold?: number
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
 * Returns the deepest hit — checks all panels in reverse z-order (last = top).
 */
export function hitTest(
  pointerX: number,
  pointerY: number,
  bounds: PanelBounds[],
  opts?: HitTestOptions,
): DockTarget | null {
  const threshold = opts?.edgeThreshold ?? 0.15
  const panelPadding = 4 // px tolerance around panel edges

  // Check from top to bottom (last panels overlap first)
  for (let i = bounds.length - 1; i >= 0; i--) {
    const b = bounds[i]
    const expanded = {
      left: b.left - panelPadding,
      top: b.top - panelPadding,
      right: b.right + panelPadding,
      bottom: b.bottom + panelPadding,
    }

    if (pointerX < expanded.left || pointerX > expanded.right || pointerY < expanded.top || pointerY > expanded.bottom) {
      continue
    }

    // Determine zone
    const relX = (pointerX - b.left) / b.width
    const relY = (pointerY - b.top) / b.height

    const zone = determineZone(relX, relY, threshold)
    return { panelId: b.id, zone }
  }

  return null
}

/**
 * Determine dock zone from relative position within a panel.
 *
 * Edge zones (left/right/top/bottom):
 *   ┌─────┬───────────┬─────┐
 *   │ top │   top     │ top │
 *   ├─────┤           ├─────┤
 *   │left │  center   │right│
 *   ├─────┤           ├─────┤
 *   │bot  │   bot     │ bot │
 *   └─────┴───────────┴─────┘
 */
function determineZone(relX: number, relY: number, threshold: number): DockZone {
  const nearLeft = relX <= threshold
  const nearRight = relX >= 1 - threshold
  const nearTop = relY <= threshold
  const nearBottom = relY >= 1 - threshold

  // Corners — favor horizontal split
  if (nearTop && nearLeft) return relX < relY ? 'left' : 'top'
  if (nearTop && nearRight) return (1 - relX) < relY ? 'right' : 'top'
  if (nearBottom && nearLeft) return relX < (1 - relY) ? 'left' : 'bottom'
  if (nearBottom && nearRight) return (1 - relX) < (1 - relY) ? 'right' : 'bottom'

  // Edge zones
  if (nearLeft) return 'left'
  if (nearRight) return 'right'
  if (nearTop) return 'top'
  if (nearBottom) return 'bottom'

  // Center — tab docking
  return 'center'
}
