// ── VolumeProfile — volume-by-price histogram ňright of the chart ──
// Displays horizontal bars showing volume at each price level.
// Data shape: { levels: Array<{ price: number, volume: number }>, barWidth?: number, color?: string }
// The runtime service computes levels from candle data.
//
// @since 3.3.6

import type { OverlayDefinition } from '../OverlayDefinition'
import type { OverlayInstance } from '../OverlayInstance'
import type { OverlayRenderContext } from '../types'

interface VolumeLevel {
  price: number
  volume: number
}

function render(ctx: OverlayRenderContext, inst: OverlayInstance): void {
  const levels = inst.data.levels as VolumeLevel[] | undefined
  if (!levels || levels.length === 0) return

  const barWidth = (inst.data.barWidth as number) ?? 80
  const color = (inst.data.color as string) ?? 'rgba(38, 166, 154, 0.3)'
  const maxVolume = Math.max(...levels.map((l) => l.volume))
  if (maxVolume === 0) return

  const xStart = ctx.width - barWidth

  ctx.ctx.save()
  ctx.ctx.fillStyle = color

  for (const level of levels) {
    const y = ctx.priceToPixel(level.price)
    const barLen = (level.volume / maxVolume) * barWidth

    // Horizontal bar from right edge going left
    ctx.ctx.fillRect(xStart + (barWidth - barLen), y - 1, barLen, 2)
  }

  ctx.ctx.restore()
}

export const volumeProfileDefinition: OverlayDefinition = {
  id: 'volume-profile',
  name: 'Volume Profile',
  category: 'volume',
  render,
}
