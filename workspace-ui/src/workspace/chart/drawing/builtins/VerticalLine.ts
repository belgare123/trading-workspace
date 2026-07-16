// ── Vertical Line ──
// Vertical line at a single time point spanning the full visible height.

import type { DrawingDefinition, DrawingRenderContext } from '../DrawingDefinition'
import { DrawingInstance } from '../DrawingInstance'
import { distanceToVerticalLine } from '../../interaction/hitTestUtils'

export const VerticalLineDefinition: DrawingDefinition = {
  id: 'vertical-line',
  name: 'Vertical Line',
  category: 'line',
  defaultStyle: {
    lineColor: '#10B981',
    lineWidth: 2,
    lineStyle: 'dashed',
  },
  create(anchor): DrawingInstance {
    return new DrawingInstance('vertical-line', [{ time: anchor.time, price: anchor.price }], {
      ...VerticalLineDefinition.defaultStyle,
    })
  },
  render(ctx: DrawingRenderContext, inst: DrawingInstance): void {
    if (inst.anchors.length < 1) return
    const x = ctx.timeToPixel(inst.anchors[0].time)

    ctx.ctx.strokeStyle = inst.style.lineColor ?? '#10B981'
    ctx.ctx.lineWidth = inst.style.lineWidth ?? 2
    if (inst.style.lineStyle === 'dashed') ctx.ctx.setLineDash([8, 4])
    else if (inst.style.lineStyle === 'dotted') ctx.ctx.setLineDash([3, 3])
    else ctx.ctx.setLineDash([])

    ctx.ctx.beginPath()
    ctx.ctx.moveTo(x, 0)
    ctx.ctx.lineTo(x, ctx.height)
    ctx.ctx.stroke()
  },
  hitTest(point, inst, context): number | null {
    if (inst.anchors.length < 1) return null
    const x = context.timeToPixel(inst.anchors[0].time)
    return distanceToVerticalLine(point.x, point.y, x)
  },
}
