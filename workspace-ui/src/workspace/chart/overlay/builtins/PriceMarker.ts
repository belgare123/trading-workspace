// ── PriceMarker — horizontal dashed line at a specific price level ──
// Displays a dashed line across the chart with a price label on the right.
// Data shape: { label?: string, color?: string, lineWidth?: number }
//
// @since 3.3.6

import type { OverlayDefinition } from '../OverlayDefinition'
import type { OverlayInstance } from '../OverlayInstance'
import type { OverlayRenderContext } from '../types'

function render(ctx: OverlayRenderContext, inst: OverlayInstance): void {
  const price = inst.position?.price
  if (price == null) return

  const y = ctx.priceToPixel(price)
  if (y < 0 || y > ctx.height) return

  const label = (inst.data.label as string) ?? price.toFixed(2)
  const color = (inst.data.color as string) ?? '#ffd54f'
  const lineWidth = (inst.data.lineWidth as number) ?? 1

  ctx.ctx.save()

  // Dashed horizontal line
  ctx.ctx.strokeStyle = color
  ctx.ctx.lineWidth = lineWidth
  ctx.ctx.setLineDash([4, 4])
  ctx.ctx.beginPath()
  ctx.ctx.moveTo(0, y)
  ctx.ctx.lineTo(ctx.width, y)
  ctx.ctx.stroke()

  // Label on the right
  ctx.ctx.setLineDash([])
  ctx.ctx.font = `11px 'Segoe UI', sans-serif`
  ctx.ctx.textAlign = 'right'
  ctx.ctx.textBaseline = 'middle'
  const text = label
  const padding = 4
  const textWidth = ctx.ctx.measureText(text).width + padding * 2

  // Label background
  ctx.ctx.fillStyle = color
  ctx.ctx.fillRect(ctx.width - textWidth, y - 9, textWidth, 18)

  // Label text
  ctx.ctx.fillStyle = '#1a1a2e'
  ctx.ctx.fillText(text, ctx.width - padding, y)

  ctx.ctx.restore()
}

export const priceMarkerDefinition: OverlayDefinition = {
  id: 'price-marker',
  name: 'Price Marker',
  category: 'price',
  render,
}
