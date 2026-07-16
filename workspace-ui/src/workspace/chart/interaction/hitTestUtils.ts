/**
 * Shared hit-test math for drawing builtins.
 * All functions operate in pixel space and return distance in pixels.
 */

/**
 * Distance from a point to a line segment (closest point on segment).
 * Returns distance in pixels.
 */
export function distanceToLineSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    // Degenerate line — distance to the single point
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
}

/**
 * Distance from a point to an infinite horizontal line at a given Y.
 */
export function distanceToHorizontalLine(_px: number, _py: number, y: number): number {
  return Math.abs(_py - y)
}

/**
 * Distance from a point to an infinite vertical line at a given X.
 */
export function distanceToVerticalLine(_px: number, _py: number, x: number): number {
  return Math.abs(_px - x)
}

/**
 * Distance from a point to a rectangle defined by two corners.
 * Returns 0 if the point is inside the rectangle.
 */
export function distanceToRect(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const left = Math.min(x1, x2)
  const right = Math.max(x1, x2)
  const top = Math.min(y1, y2)
  const bottom = Math.max(y1, y2)

  if (px >= left && px <= right && py >= top && py <= bottom) return 0

  const cx = Math.max(left, Math.min(px, right))
  const cy = Math.max(top, Math.min(py, bottom))
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
}

/**
 * Distance from a point to a single anchor point (time, price).
 */
export function distanceToPoint(
  px: number, py: number,
  ax: number, ay: number,
): number {
  return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2)
}
