// ── EdgeRenderer — Multi-layer edge rendering ──
//
// LayerRenderer that draws all edges as bezier curves on the canvas.
// Supports: selected, highlighted, animated, conditional, temporary.
//
// @since 3.6.3

import type { LayerRenderer } from '../rendering/Renderer'
import type { ViewportState } from '../viewport/ViewportState'
import type { RenderFrame } from '../types'
import type { EdgeViewModel } from './types'

/** Render a single bezier curve path on the context */
function bezierCurve(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
): void {
  if (pts.length < 2) return
  ctx.moveTo(pts[0].x, pts[0].y)

  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y)
  } else if (pts.length === 4) {
    ctx.bezierCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y)
  } else {
    // Polyline fallback for orthogonal
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y)
    }
  }
}

export class EdgeRenderer implements LayerRenderer {
  readonly layerId = 'edges'

  private _edges: EdgeViewModel[] = []
  /** Temporary edge during connection drag */
  private _tempEdge: EdgeViewModel | null = null

  /** Set the current edge views to render */
  setEdges(edges: EdgeViewModel[]): void {
    this._edges = edges
  }

  /** Set a temporary edge (rubber-band during connection) */
  setTempEdge(edge: EdgeViewModel | null): void {
    this._tempEdge = edge
  }

  render(ctx: CanvasRenderingContext2D, _viewport: ViewportState, _frame: RenderFrame): void {
    ctx.save()

    // ── All permanent edges ──
    for (const edge of this._edges) {
      this._drawEdge(ctx, edge)
    }

    // ── Temporary edge (connection rubber-band) ──
    if (this._tempEdge) {
      ctx.setLineDash([6, 4])
      ctx.strokeStyle = 'rgba(74, 158, 255, 0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      bezierCurve(ctx, this._tempEdge.controlPoints)
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.restore()
  }

  private _drawEdge(ctx: CanvasRenderingContext2D, edge: EdgeViewModel): void {
    const { controlPoints: pts, selected, highlighted, animated, label } = edge

    if (pts.length < 2) return

    // ── Animation pulse (execution) ──
    if (animated) {
      ctx.save()
      ctx.strokeStyle = '#4ADE80'
      ctx.lineWidth = 3
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() * 0.005)
      ctx.beginPath()
      bezierCurve(ctx, pts)
      ctx.stroke()
      ctx.restore()
    }

    // ── Selection highlight ──
    if (selected) {
      ctx.save()
      ctx.strokeStyle = '#4A9EFF'
      ctx.lineWidth = 4
      ctx.beginPath()
      bezierCurve(ctx, pts)
      ctx.stroke()
      ctx.globalAlpha = 0.15
      ctx.lineWidth = 8
      ctx.beginPath()
      bezierCurve(ctx, pts)
      ctx.stroke()
      ctx.restore()
    }

    // ── Main edge ──
    ctx.strokeStyle = selected
      ? '#4A9EFF'
      : highlighted
        ? 'rgba(74, 158, 255, 0.6)'
        : 'rgba(255, 255, 255, 0.25)'
    ctx.lineWidth = selected ? 2.5 : highlighted ? 2 : 1.5
    ctx.beginPath()
    bezierCurve(ctx, pts)
    ctx.stroke()

    // ── Arrow (small triangle at target) ──
    const last = pts[pts.length - 1]
    const prev = pts[pts.length - 2]
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x)
    const arrowSize = 6
    ctx.fillStyle = ctx.strokeStyle
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(
      last.x - arrowSize * Math.cos(angle - 0.4),
      last.y - arrowSize * Math.sin(angle - 0.4),
    )
    ctx.lineTo(
      last.x - arrowSize * Math.cos(angle + 0.4),
      last.y - arrowSize * Math.sin(angle + 0.4),
    )
    ctx.closePath()
    ctx.fill()

    // ── Label ──
    if (label) {
      const mid = pts[Math.floor(pts.length / 2)]
      ctx.fillStyle = '#9CA3AF'
      ctx.font = '11px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(label, mid.x, mid.y - 4)
    }

    // ── Condition badge ──
    if (edge.condition) {
      const mid = pts[Math.floor(pts.length / 2)]
      ctx.fillStyle = '#F59E0B'
      ctx.font = 'bold 10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText('if', mid.x, mid.y + 4)
    }
  }
}
