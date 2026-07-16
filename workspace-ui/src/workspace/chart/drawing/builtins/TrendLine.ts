// ── Trend Line ──
// Straight line between two anchors.

import type { DrawingDefinition, DrawingRenderContext } from '../DrawingDefinition'
import { DrawingInstance } from '../DrawingInstance'
import { distanceToLineSegment } from '../../interaction/hitTestUtils'

const HOUR_SECONDS = 3600
const DEFAULT_OFFSET = 5 * HOUR_SECONDS // 5 hours for second anchor default

export const TrendLineDefinition: DrawingDefinition = {
  id: 'trend-line',
  name: 'Trend Line',
  category: 'line',
  defaultStyle: {
    lineColor: '#8B5CF6',
    lineWidth: 2,
    lineStyle: 'solid',
  },
  create(anchor): DrawingInstance {
    const anchors = [
      { time: anchor.time, price: anchor.price },
      { time: anchor.time + DEFAULT_OFFSET, price: anchor.price + 50 },
    ]
    return new DrawingInstance('trend-line', anchors, { ...TrendLineDefinition.defaultStyle })
  },
  render(ctx: DrawingRenderContext, inst: DrawingInstance): void {
    if (inst.anchors.length < 2) return

    const x1 = ctx.timeToPixel(inst.anchors[0].time)
    const y1 = ctx.priceToPixel(inst.anchors[0].price)
    const x2 = ctx.timeToPixel(inst.anchors[1].time)
    const y2 = ctx.priceToPixel(inst.anchors[1].price)

    applyLineStyle(ctx, inst.style)
    ctx.ctx.beginPath()
    ctx.ctx.moveTo(x1, y1)
    ctx.ctx.lineTo(x2, y2)
    ctx.ctx.stroke()
  },
  hitTest(point, inst, context): number | null {
    if (inst.anchors.length < 2) return null
    const x1 = context.timeToPixel(inst.anchors[0].time)
    const y1 = context.priceToPixel(inst.anchors[0].price)
    const x2 = context.timeToPixel(inst.anchors[1].time)
    const y2 = context.priceToPixel(inst.anchors[1].price)
    return distanceToLineSegment(point.x, point.y, x1, y1, x2, y2)
  },
}

/** Apply common line style from DrawingStyle to the canvas context */
function applyLineStyle(ctx: DrawingRenderContext, style: DrawingInstance['style']): void {
  ctx.ctx.strokeStyle = style.lineColor ?? '#8B5CF6'
  ctx.ctx.lineWidth = style.lineWidth ?? 2
  if (style.lineStyle === 'dashed') {
    ctx.ctx.setLineDash([8, 4])
  } else if (style.lineStyle === 'dotted') {
    ctx.ctx.setLineDash([3, 3])
  } else {
    ctx.ctx.setLineDash([])
  }
}
