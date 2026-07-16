// ── ExecutionMarker — fill execution marker ──
// Displays a small filled circle at the fill price with quantity label.
// Data shape: { side: 'buy' | 'sell', quantity: number, price: number, time?: number, label?: string }
//
// @since 3.3.6

import type { OverlayDefinition } from '../OverlayDefinition'
import type { OverlayInstance } from '../OverlayInstance'
import type { OverlayRenderContext } from '../types'

function render(ctx: OverlayRenderContext, inst: OverlayInstance): void {
  const time = inst.position?.time
  const price = inst.position?.price
  if (time == null || price == null) return

  const x = ctx.timeToPixel(time)
  const y = ctx.priceToPixel(price)
  if (x < 0 || x > ctx.width || y < 0 || y > ctx.height) return

  const side = inst.data.side as string ?? 'buy'
  const qty = inst.data.quantity as number ?? 0
  const label = inst.data.label as string ?? (qty > 0 ? `${qty}` : '')
  const isBuy = side === 'buy'
  const color = isBuy ? '#66bb6a' : '#ef5350'

  ctx.ctx.save()

  // Filled circle
  ctx.ctx.fillStyle = color
  ctx.ctx.strokeStyle = '#1a1a2e'
  ctx.ctx.lineWidth = 1.5
  ctx.ctx.beginPath()
  ctx.ctx.arc(x, y, 4, 0, Math.PI * 2)
  ctx.ctx.fill()
  ctx.ctx.stroke()

  // Quantity label
  if (label) {
    ctx.ctx.font = `9px 'Segoe UI', sans-serif`
    ctx.ctx.textBaseline = 'bottom'
    ctx.ctx.textAlign = 'left'
    ctx.ctx.fillStyle = color
    ctx.ctx.fillText(label, x + 7, y - 1)
  }

  ctx.ctx.restore()
}

export const executionMarkerDefinition: OverlayDefinition = {
  id: 'execution-marker',
  name: 'Execution Marker',
  category: 'trade',
  render,
}
