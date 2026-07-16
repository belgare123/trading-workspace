// ── OrderMarker — buy/sell order entry marker ──
// Displays an arrow (up=green for buy, down=red for sell) at the order price.
// Data shape: { side: 'buy' | 'sell', quantity?: number, label?: string, color?: string }
//
// @since 3.3.6

import type { OverlayDefinition } from '../OverlayDefinition'
import type { OverlayInstance } from '../OverlayInstance'
import type { OverlayRenderContext } from '../types'

const ARROW_SIZE = 8

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

  ctx.ctx.save()

  // Arrow
  ctx.ctx.fillStyle = isBuy ? '#26a69a' : '#ef5350'
  ctx.ctx.beginPath()
  if (isBuy) {
    // Upward triangle
    ctx.ctx.moveTo(x, y - ARROW_SIZE)
    ctx.ctx.lineTo(x - ARROW_SIZE, y)
    ctx.ctx.lineTo(x + ARROW_SIZE, y)
  } else {
    // Downward triangle
    ctx.ctx.moveTo(x, y + ARROW_SIZE)
    ctx.ctx.lineTo(x - ARROW_SIZE, y)
    ctx.ctx.lineTo(x + ARROW_SIZE, y)
  }
  ctx.ctx.closePath()
  ctx.ctx.fill()

  // Label next to arrow
  if (label) {
    ctx.ctx.font = `10px 'Segoe UI', sans-serif`
    ctx.ctx.textBaseline = 'middle'
    ctx.ctx.textAlign = 'left'
    ctx.ctx.fillStyle = isBuy ? '#26a69a' : '#ef5350'
    ctx.ctx.fillText(label, x + ARROW_SIZE + 4, y)
  }

  ctx.ctx.restore()
}

export const orderMarkerDefinition: OverlayDefinition = {
  id: 'order-marker',
  name: 'Order Marker',
  category: 'trade',
  render,
}
