// ── PositionMarker — position entry/exit marker ──
// Displays a diamond at entry price, with optional entry/exit lines.
// Data shape: { side: 'long' | 'short', entryPrice: number, exitPrice?: number,
//              quantity?: number, pnl?: number, label?: string }
//
// @since 3.3.6

import type { OverlayDefinition } from '../OverlayDefinition'
import type { OverlayInstance } from '../OverlayInstance'
import type { OverlayRenderContext } from '../types'

const DIAMOND_SIZE = 6

function render(ctx: OverlayRenderContext, inst: OverlayInstance): void {
  const time = inst.position?.time
  const price = inst.position?.price
  if (time == null || price == null) return

  const x = ctx.timeToPixel(time)
  if (x < 0 || x > ctx.width) return

  const side = inst.data.side as string ?? 'long'
  const entryPrice = inst.data.entryPrice as number ?? price
  const exitPrice = inst.data.exitPrice as number | undefined
  const qty = inst.data.quantity as number ?? 0
  const pnl = inst.data.pnl as number | undefined
  const isLong = side === 'long'
  const color = isLong ? '#26a69a' : '#ef5350'

  ctx.ctx.save()

  const entryY = ctx.priceToPixel(entryPrice)

  // Diamond at entry
  ctx.ctx.fillStyle = color
  ctx.ctx.strokeStyle = color
  ctx.ctx.lineWidth = 1
  ctx.ctx.beginPath()
  ctx.ctx.moveTo(x, entryY - DIAMOND_SIZE)
  ctx.ctx.lineTo(x + DIAMOND_SIZE, entryY)
  ctx.ctx.lineTo(x, entryY + DIAMOND_SIZE)
  ctx.ctx.lineTo(x - DIAMOND_SIZE, entryY)
  ctx.ctx.closePath()
  ctx.ctx.fill()

  // Exit line if present
  if (exitPrice != null) {
    const exitY = ctx.priceToPixel(exitPrice)
    ctx.ctx.setLineDash([3, 3])
    ctx.ctx.strokeStyle = pnl != null && pnl > 0 ? '#26a69a' : pnl != null && pnl < 0 ? '#ef5350' : color
    ctx.ctx.beginPath()
    ctx.ctx.moveTo(x, entryY)
    ctx.ctx.lineTo(x, exitY)
    ctx.ctx.stroke()
    ctx.ctx.setLineDash([])

    // Small cross at exit
    ctx.ctx.strokeStyle = pnl != null && pnl > 0 ? '#26a69a' : '#ef5350'
    ctx.ctx.beginPath()
    ctx.ctx.moveTo(x - 3, exitY - 3)
    ctx.ctx.lineTo(x + 3, exitY + 3)
    ctx.ctx.moveTo(x + 3, exitY - 3)
    ctx.ctx.lineTo(x - 3, exitY + 3)
    ctx.ctx.stroke()
  }

  // Label
  const labelParts: string[] = []
  if (qty > 0) labelParts.push(`${qty}`)
  if (pnl != null) labelParts.push(pnl > 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2))
  const label = inst.data.label as string ?? labelParts.join(' | ')

  if (label) {
    ctx.ctx.font = `10px 'Segoe UI', sans-serif`
    ctx.ctx.textBaseline = 'middle'
    ctx.ctx.textAlign = 'left'
    ctx.ctx.fillStyle = color
    ctx.ctx.fillText(label, x + DIAMOND_SIZE + 4, entryY)
  }

  ctx.ctx.restore()
}

export const positionMarkerDefinition: OverlayDefinition = {
  id: 'position-marker',
  name: 'Position Marker',
  category: 'trade',
  render,
}
