// ── EdgeView — Converts StrategyEdge + node positions → EdgeViewModel ──
//
// Pure function — no side effects. Computes visual edge data from
// domain data and current node positions.
//
// @since 3.6.3

import type { StrategyEdge } from '../../strategy/composition/types'
import type { NodeViewModel } from '../nodes/types'
import type { EdgeViewModel, EdgeStyle } from './types'

/** Default bezier offset from each endpoint */
const BEZIER_OFFSET = 50

/** Build an EdgeViewModel from domain edge + source/target node view models */
export function buildEdgeView(
  edge: StrategyEdge,
  sourceNode: NodeViewModel | undefined,
  targetNode: NodeViewModel | undefined,
  style: EdgeStyle = 'bezier',
): EdgeViewModel {
  const sourcePos = sourceNode
    ? { x: sourceNode.position.x + sourceNode.size.width, y: sourceNode.position.y + sourceNode.size.height / 2 }
    : { x: 0, y: 0 }

  const targetPos = targetNode
    ? { x: targetNode.position.x, y: targetNode.position.y + targetNode.size.height / 2 }
    : { x: 0, y: 0 }

  return {
    id: edge.id,
    sourceId: edge.sourceId,
    sourcePortId: 'auto',
    targetId: edge.targetId,
    targetPortId: 'auto',
    style,
    controlPoints: computeControlPoints(sourcePos, targetPos, style),
    highlighted: false,
    selected: false,
    animated: false,
    label: edge.label,
    condition: edge.condition,
  }
}

/** Build EdgeViewModels for all edges in a StrategyEdge[] array */
export function buildAllEdgeViews(
  edges: StrategyEdge[],
  getNode: (id: string) => NodeViewModel | undefined,
): EdgeViewModel[] {
  return edges.map(edge => buildEdgeView(edge, getNode(edge.sourceId), getNode(edge.targetId)))
}

/** Compute bezier control points between two endpoints */
export function computeControlPoints(
  source: { x: number; y: number },
  target: { x: number; y: number },
  style: EdgeStyle,
): { x: number; y: number }[] {
  switch (style) {
    case 'straight':
      return [source, target]

    case 'orthogonal': {
      const midX = (source.x + target.x) / 2
      return [
        source,
        { x: midX, y: source.y },
        { x: midX, y: target.y },
        target,
      ]
    }

    case 'bezier':
    default: {
      const dx = Math.abs(target.x - source.x)
      const offset = Math.max(BEZIER_OFFSET, dx * 0.4)
      return [
        source,
        { x: source.x + offset, y: source.y },
        { x: target.x - offset, y: target.y },
        target,
      ]
    }
  }
}

/** Calculate point on a cubic bezier curve at parameter t (0..1) */
export function bezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
  }
}
