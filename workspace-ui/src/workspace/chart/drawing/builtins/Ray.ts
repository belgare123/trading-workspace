// ── Ray ──
// Line starting from an anchor extending to the right edge of the visible range.

import type { DrawingDefinition, DrawingRenderContext } from '../DrawingDefinition'
import { DrawingInstance } from '../DrawingInstance'
import type { DrawingStyle } from '../types'
import { distanceToLineSegment, distanceToVerticalLine } from '../../interaction/hitTestUtils'

export const RayDefinition: DrawingDefinition = {
  id: 'ray',
  name: 'Ray',
  category: 'line',
  defaultStyle: {
    lineColor: '#EC4899',
    lineWidth: 2,
    lineStyle: 'solid',
  },
  create(anchor): DrawingInstance {
    return new DrawingInstance('ray', [{ time: anchor.time, price: anchor.price }], {
      ...RayDefinition.defaultStyle,
    })
  },
  render(ctx: DrawingRenderContext, inst: DrawingInstance): void {
    if (inst.anchors.length < 1) return

    const x1 = ctx.timeToPixel(inst.anchors[0].time)
    const y1 = ctx.priceToPixel(inst.anchors[0].price)

    // Ray extends to the right edge — compute slope using second anchor if available,
    // otherwise draw horizontal from the anchor to the right
    let slope = 0
    if (inst.anchors.length >= 2 && inst.anchors[1].time !== inst.anchors[0].time) {
      const dt = ctx.timeToPixel(inst.anchors[1].time) - x1
      if (dt !== 0) {
        const dy = ctx.priceToPixel(inst.anchors[1].price) - y1
        slope = dy / dt
      }
    }

    const xEnd = ctx.width
    const yEnd = y1 + slope * (xEnd - x1)

    applyLineStyle(ctx, inst.style)
    ctx.ctx.beginPath()
    ctx.ctx.moveTo(x1, y1)
    ctx.ctx.lineTo(xEnd, yEnd)
    ctx.ctx.stroke()
  },
  hitTest(point, inst, context): number | null {
    if (inst.anchors.length < 1) return null
    const x1 = context.timeToPixel(inst.anchors[0].time)
    const y1 = context.priceToPixel(inst.anchors[0].price)

    // If point is left of the anchor, no hit
    if (point.x < x1) return null

    // Compute slope for the ray direction
    let x2: number
    let y2: number
    if (inst.anchors.length >= 2 && inst.anchors[1].time !== inst.anchors[0].time) {
      const ax2 = context.timeToPixel(inst.anchors[1].time)
      const ay2 = context.priceToPixel(inst.anchors[1].price)
      const dt = ax2 - x1
      if (dt !== 0) {
        const dy = ay2 - y1
        const slope = dy / dt
        x2 = point.x + 10000 // far to the right
        y2 = y1 + slope * (x2 - x1)
      } else {
        // Vertical ray from anchor
        return distanceToVerticalLine(point.x, point.y, x1)
      }
    } else {
      // Horizontal ray
      x2 = point.x + 10000
      y2 = y1
    }

    return distanceToLineSegment(point.x, point.y, x1, y1, x2, y2)
  },
}

function applyLineStyle(ctx: DrawingRenderContext, style: DrawingStyle): void {
  ctx.ctx.strokeStyle = style.lineColor ?? '#EC4899'
  ctx.ctx.lineWidth = style.lineWidth ?? 2
  if (style.lineStyle === 'dashed') ctx.ctx.setLineDash([8, 4])
  else if (style.lineStyle === 'dotted') ctx.ctx.setLineDash([3, 3])
  else ctx.ctx.setLineDash([])
}
