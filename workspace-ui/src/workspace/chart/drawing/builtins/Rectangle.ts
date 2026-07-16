// ── Rectangle ──
// Rectangle between two anchors with optional fill and border.

import type { DrawingDefinition, DrawingRenderContext } from '../DrawingDefinition'
import { DrawingInstance } from '../DrawingInstance'
import { distanceToRect } from '../../interaction/hitTestUtils'

const HOUR_SECONDS = 3600
const DEFAULT_OFFSET = 5 * HOUR_SECONDS

export const RectangleDefinition: DrawingDefinition = {
  id: 'rectangle',
  name: 'Rectangle',
  category: 'shape',
  defaultStyle: {
    lineColor: '#3B82F6',
    lineWidth: 2,
    lineStyle: 'solid',
    fillColor: 'rgba(59, 130, 246, 0.1)',
  },
  create(anchor): DrawingInstance {
    return new DrawingInstance(
      'rectangle',
      [
        { time: anchor.time, price: anchor.price },
        { time: anchor.time + DEFAULT_OFFSET, price: anchor.price + 100 },
      ],
      { ...RectangleDefinition.defaultStyle },
    )
  },
  render(ctx: DrawingRenderContext, inst: DrawingInstance): void {
    if (inst.anchors.length < 2) return

    const x1 = ctx.timeToPixel(inst.anchors[0].time)
    const y1 = ctx.priceToPixel(inst.anchors[0].price)
    const x2 = ctx.timeToPixel(inst.anchors[1].time)
    const y2 = ctx.priceToPixel(inst.anchors[1].price)

    const left = Math.min(x1, x2)
    const top = Math.min(y1, y2)
    const right = Math.max(x1, x2)
    const bottom = Math.max(y1, y2)
    const w = right - left
    const h = bottom - top

    // Fill (if configured)
    if (inst.style.fillColor) {
      ctx.ctx.fillStyle = inst.style.fillColor
      ctx.ctx.fillRect(left, top, w, h)
    }

    // Border
    ctx.ctx.strokeStyle = inst.style.lineColor ?? '#3B82F6'
    ctx.ctx.lineWidth = inst.style.lineWidth ?? 2
    if (inst.style.lineStyle === 'dashed') ctx.ctx.setLineDash([8, 4])
    else if (inst.style.lineStyle === 'dotted') ctx.ctx.setLineDash([3, 3])
    else ctx.ctx.setLineDash([])

    ctx.ctx.strokeRect(left, top, w, h)
  },
  hitTest(point, inst, context): number | null {
    if (inst.anchors.length < 2) return null
    const x1 = context.timeToPixel(inst.anchors[0].time)
    const y1 = context.priceToPixel(inst.anchors[0].price)
    const x2 = context.timeToPixel(inst.anchors[1].time)
    const y2 = context.priceToPixel(inst.anchors[1].price)
    return distanceToRect(point.x, point.y, x1, y1, x2, y2)
  },
}
