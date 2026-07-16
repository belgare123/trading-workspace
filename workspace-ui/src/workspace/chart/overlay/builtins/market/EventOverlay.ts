// ── AlertMarker — price alert marker ──
// Displays a thin horizontal line at the alert price with a star/bell icon.
// Data shape: { label?: string, color?: string, direction?: 'above' | 'below', triggered?: boolean }
//
// @since 3.3.6

import type { OverlayDefinition } from '../../OverlayDefinition'
import type { OverlayInstance } from '../../OverlayInstance'
import type { OverlayRenderContext } from '../../types'

function render(ctx: OverlayRenderContext, inst: OverlayInstance): void {
  const time = inst.position?.time
  const price = inst.position?.price
  if (time == null || price == null) return

  const x = ctx.timeToPixel(time)
  const y = ctx.priceToPixel(price)
  if (x < 0 || x > ctx.width || y < 0 || y > ctx.height) return

  const label = inst.data.label as string ?? ''
  const color = (inst.data.color as string) ?? '#ffa726'
  const triggered = inst.data.triggered as boolean ?? false
  const opacity = triggered ? 0.4 : 1

  ctx.ctx.save()
  ctx.ctx.globalAlpha = opacity

  // Horizontal line (dotted)
  ctx.ctx.strokeStyle = color
  ctx.ctx.lineWidth = 1
  ctx.ctx.setLineDash([2, 4])
  ctx.ctx.beginPath()
  ctx.ctx.moveTo(0, y)
  ctx.ctx.lineTo(ctx.width, y)
  ctx.ctx.stroke()
  ctx.ctx.setLineDash([])

  // Star/alert icon at the right edge
  const cx = ctx.width - 14
  ctx.ctx.fillStyle = color
  ctx.ctx.font = `14px 'Segoe UI', sans-serif`
  ctx.ctx.textAlign = 'center'
  ctx.ctx.textBaseline = 'middle'
  ctx.ctx.fillText('\u26A0', cx, y) // ⚠ warning sign

  // Label near the icon
  if (label) {
    ctx.ctx.font = `10px 'Segoe UI', sans-serif`
    ctx.ctx.textAlign = 'left'
    ctx.ctx.fillText(label, ctx.width - 22, y)
  }

  ctx.ctx.restore()
}

export const alertMarkerDefinition: OverlayDefinition = {
  id: 'alert-marker',
  name: 'Alert Marker',
  category: 'event',
  render,
}
