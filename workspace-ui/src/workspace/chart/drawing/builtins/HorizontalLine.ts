// ── Horizontal Line ──
// Horizontal line at a single price level spanning the full visible width.

import type { DrawingDefinition, DrawingRenderContext } from '../DrawingDefinition'
import { DrawingInstance } from '../DrawingInstance'
import { distanceToHorizontalLine } from '../../interaction/hitTestUtils'

export const HorizontalLineDefinition: DrawingDefinition = {
  id: 'horizontal-line',
  name: 'Horizontal Line',
  category: 'line',
  defaultStyle: {
    lineColor: '#F59E0B',
    lineWidth: 2,
    lineStyle: 'dashed',
  },
  create(anchor): DrawingInstance {
    return new DrawingInstance('horizontal-line', [{ time: anchor.time, price: anchor.price }], {
      ...HorizontalLineDefinition.defaultStyle,
    })
  },
  render(ctx: DrawingRenderContext, inst: DrawingInstance): void {
    if (inst.anchors.length < 1) return
    const y = ctx.priceToPixel(inst.anchors[0].price)

    ctx.ctx.strokeStyle = inst.style.lineColor ?? '#F59E0B'
    ctx.ctx.lineWidth = inst.style.lineWidth ?? 2
    if (inst.style.lineStyle === 'dashed') ctx.ctx.setLineDash([8, 4])
    else if (inst.style.lineStyle === 'dotted') ctx.ctx.setLineDash([3, 3])
    else ctx.ctx.setLineDash([])

    ctx.ctx.beginPath()
    ctx.ctx.moveTo(0, y)
    ctx.ctx.lineTo(ctx.width, y)
    ctx.ctx.stroke()
  },
  hitTest(point, inst, context): number | null {
    if (inst.anchors.length < 1) return null
    const y = context.priceToPixel(inst.anchors[0].price)
    return distanceToHorizontalLine(point.x, point.y, y)
  },
}
