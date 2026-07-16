// ── SessionBox — time-range highlight box ──
// Displays a semi-transparent rectangle for a specific trading session.
// Data shape: { startTime: number, endTime: number, label?: string,
//              color?: string, showLabel?: boolean }
//
// @since 3.3.6

import type { OverlayDefinition } from '../OverlayDefinition'
import type { OverlayInstance } from '../OverlayInstance'
import type { OverlayRenderContext } from '../types'

function render(ctx: OverlayRenderContext, inst: OverlayInstance): void {
  const startTime = inst.data.startTime as number | undefined
  const endTime = inst.data.endTime as number | undefined
  if (startTime == null || endTime == null) return

  const x1 = ctx.timeToPixel(startTime)
  const x2 = ctx.timeToPixel(endTime)

  // Clamp to visible range
  const left = Math.max(0, Math.min(x1, x2))
  const right = Math.min(ctx.width, Math.max(x1, x2))
  if (left >= right) return

  const label = inst.data.label as string ?? ''
  const color = (inst.data.color as string) ?? 'rgba(255, 183, 77, 0.1)'
  const showLabel = inst.data.showLabel as boolean ?? true

  ctx.ctx.save()

  // Fill
  ctx.ctx.fillStyle = color
  ctx.ctx.fillRect(left, 0, right - left, ctx.height)

  // Left border
  ctx.ctx.strokeStyle = color.startsWith('rgba')
    ? color.replace(/[\d.]+\)$/, '0.5)')
    : 'rgba(255, 183, 77, 0.4)'
  ctx.ctx.lineWidth = 1
  ctx.ctx.beginPath()
  ctx.ctx.moveTo(left, 0)
  ctx.ctx.lineTo(left, ctx.height)
  ctx.ctx.stroke()

  // Label at top-left of the box
  if (showLabel && label) {
    ctx.ctx.font = `10px 'Segoe UI', sans-serif`
    ctx.ctx.textBaseline = 'top'
    ctx.ctx.textAlign = 'left'
    ctx.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.ctx.fillText(label, left + 4, 4)
  }

  ctx.ctx.restore()
}

export const sessionBoxDefinition: OverlayDefinition = {
  id: 'session-box',
  name: 'Session Box',
  category: 'session',
  render,
}
