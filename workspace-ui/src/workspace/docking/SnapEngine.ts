/**
 * SnapEngine — calculates dock zone preview positions and snap alignment
 *
 * Converts hit-test results into pixel coordinates for overlay rendering.
 * Knows nothing about LayoutEngine calls — only geometry.
 *
 * @since 3.2.3
 */

import type { DockZone } from './types'
import type { PanelBounds } from './HitTesting'

export interface ZoneRect {
  zone: DockZone
  left: number
  top: number
  width: number
  height: number
}

/**
 * Calculate the preview rect for a dock target within a panel bounds.
 *
 * Split zones take a percentage of the parent panel:
 *   - left/right: 50% width
 *   - top/bottom: 50% height
 *   - center: 100% (tab docking — panel contains both as tabs)
 *   - floating: 70% centered
 */
export function calculateZoneRect(bounds: PanelBounds, zone: DockZone): ZoneRect {
  switch (zone) {
    case 'left':
      return {
        zone,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width * 0.5,
        height: bounds.height,
      }
    case 'right':
      return {
        zone,
        left: bounds.left + bounds.width * 0.5,
        top: bounds.top,
        width: bounds.width * 0.5,
        height: bounds.height,
      }
    case 'top':
      return {
        zone,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height * 0.5,
      }
    case 'bottom':
      return {
        zone,
        left: bounds.left,
        top: bounds.top + bounds.height * 0.5,
        width: bounds.width,
        height: bounds.height * 0.5,
      }
    case 'center':
      return {
        zone,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      }
    case 'floating':
      return {
        zone,
        left: bounds.left + bounds.width * 0.15,
        top: bounds.top + bounds.height * 0.15,
        width: bounds.width * 0.7,
        height: bounds.height * 0.7,
      }
  }
}

/** Snap tolerance in pixels */
const SNAP_THRESHOLD = 8

export interface SnapAlignment {
  x: number
  y: number
  snapped: boolean
}

/**
 * Snap a position to align with other panel boundaries.
 */
export function snapPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: PanelBounds[],
): SnapAlignment {
  let snappedX = x
  let snappedY = y
  let snapped = false

  for (const b of bounds) {
    // Snap left edge to panel left
    if (Math.abs(x - b.left) < SNAP_THRESHOLD) {
      snappedX = b.left
      snapped = true
    }
    // Snap left edge to panel right
    if (Math.abs(x - b.right) < SNAP_THRESHOLD) {
      snappedX = b.right
      snapped = true
    }
    // Snap top edge to panel top
    if (Math.abs(y - b.top) < SNAP_THRESHOLD) {
      snappedY = b.top
      snapped = true
    }
    // Snap top edge to panel bottom
    if (Math.abs(y - b.bottom) < SNAP_THRESHOLD) {
      snappedY = b.bottom
      snapped = true
    }
    // Snap right edge to panel right
    if (Math.abs(x + width - b.right) < SNAP_THRESHOLD) {
      snappedX = b.right - width
      snapped = true
    }
    // Snap bottom edge to panel bottom
    if (Math.abs(y + height - b.bottom) < SNAP_THRESHOLD) {
      snappedY = b.bottom - height
      snapped = true
    }
  }

  return { x: snappedX, y: snappedY, snapped }
}
