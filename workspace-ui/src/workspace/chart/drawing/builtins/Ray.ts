// ── Ray ──
// Line starting from an anchor extending to the right edge of the visible range.

import type { DrawingDefinition, DrawingRenderContext } from '../DrawingDefinition'
import { DrawingInstance } from '../DrawingInstance'
import type { DrawingStyle } from '../types'

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
}

function applyLineStyle(ctx: DrawingRenderContext, style: DrawingStyle): void {
  ctx.ctx.strokeStyle = style.lineColor ?? '#EC4899'
  ctx.ctx.lineWidth = style.lineWidth ?? 2
  if (style.lineStyle === 'dashed') ctx.ctx.setLineDash([8, 4])
  else if (style.lineStyle === 'dotted') ctx.ctx.setLineDash([3, 3])
  else ctx.ctx.setLineDash([])
}
