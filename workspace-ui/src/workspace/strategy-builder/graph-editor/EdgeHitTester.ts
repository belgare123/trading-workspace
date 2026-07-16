// ── EdgeHitTester — Hit-test edges near a point ──
//
// Checks if a screen-space point is within tolerance of any edge.
// Used for edge selection, hover detection, and context menus.
//
// @since 3.6.3

import type { EdgeViewModel } from './types'
import { bezierPoint } from './EdgeView'

/** Distance tolerance for edge hit testing (in graph coordinates) */
const HIT_TOLERANCE = 8

/** Sample count along the bezier for hit testing */
const SAMPLE_COUNT = 40

/** Hit-test a single edge against a point */
export function hitTestEdge(edge: EdgeViewModel, point: { x: number; y: number }): boolean {
  const pts = edge.controlPoints
  if (pts.length < 2) return false

  if (pts.length === 4) {
    // Cubic bezier: sample the curve
    for (let i = 0; i <= SAMPLE_COUNT; i++) {
      const t = i / SAMPLE_COUNT
      const bp = bezierPoint(pts[0], pts[1], pts[2], pts[3], t)
      const dx = bp.x - point.x
      const dy = bp.y - point.y
      if (dx * dx + dy * dy <= HIT_TOLERANCE * HIT_TOLERANCE) return true
    }
  } else {
    // Polyline: per-segment distance
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      const dist = pointToSegmentDist(point, a, b)
      if (dist <= HIT_TOLERANCE) return true
    }
  }

  return false
}

/** Find the first edge hit by a point */
export function hitTestEdges(
  edges: EdgeViewModel[],
  point: { x: number; y: number },
): EdgeViewModel | null {
  // Reverse order: topmost (last rendered) first
  for (let i = edges.length - 1; i >= 0; i--) {
    if (hitTestEdge(edges[i], point)) return edges[i]
  }
  return null
}

/** Minimum distance from point P to segment AB */
function pointToSegmentDist(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)

  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
  t = Math.max(0, Math.min(1, t))

  const cx = a.x + t * abx
  const cy = a.y + t * aby
  return Math.hypot(p.x - cx, p.y - cy)
}
