// ── Text ──
// Text label positioned at an anchor point.

import type { DrawingDefinition, DrawingRenderContext } from '../DrawingDefinition'
import { DrawingInstance } from '../DrawingInstance'

export const TextDefinition: DrawingDefinition = {
  id: 'text',
  name: 'Text',
  category: 'annotation',
  defaultStyle: {
    lineColor: '#FFFFFF',
    fontSize: 14,
    font: 'Inter, system-ui, sans-serif',
    fillColor: 'rgba(0, 0, 0, 0.6)',
  },
  create(anchor): DrawingInstance {
    const inst = new DrawingInstance('text', [{ time: anchor.time, price: anchor.price }], {
      ...TextDefinition.defaultStyle,
    })
    inst.metadata = { text: 'Label' }
    return inst
  },
  render(ctx: DrawingRenderContext, inst: DrawingInstance): void {
    if (inst.anchors.length < 1) return

    const x = ctx.timeToPixel(inst.anchors[0].time)
    const y = ctx.priceToPixel(inst.anchors[0].price)
    const text = (inst.metadata?.text as string) ?? 'Label'
    const fontSize = inst.style.fontSize ?? 14
    const font = inst.style.font ?? 'Inter, system-ui, sans-serif'

    ctx.ctx.font = `${fontSize}px ${font}`
    const metrics = ctx.ctx.measureText(text)
    const padding = 6
    const bw = metrics.width + padding * 2
    const bh = fontSize + padding * 2

    // Background fill
    if (inst.style.fillColor) {
      ctx.ctx.fillStyle = inst.style.fillColor
      ctx.ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh)
    }

    // Text
    ctx.ctx.fillStyle = inst.style.lineColor ?? '#FFFFFF'
    ctx.ctx.textAlign = 'center'
    ctx.ctx.textBaseline = 'middle'
    ctx.ctx.fillText(text, x, y)
  },
}
