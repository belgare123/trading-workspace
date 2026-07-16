// ── OpeningRangeOverlay — opening range high/low rectangle ──
// Renders a coloured rectangle spanning the opening time window with
// horizontal lines at the high and low prices.
//
// Data shape:
//   high: number           (opening range high price)
//   low: number            (opening range low price)
//   startTime: number      (epoch ms — range start)
//   endTime: number        (epoch ms — range end)
//
// @since 3.3.8

import type { OverlayDefinition } from '../../OverlayDefinition'
import type { OverlayInstance } from '../../OverlayInstance'
import type { OverlayRenderContext } from '../../types'
import { renderLine, DEFAULT_STYLE } from '../../PriceLineOverlayBase'
import type { PriceLineStyle } from '../../PriceLineOverlayBase'

function render(ctx: OverlayRenderContext, inst: OverlayInstance): void {
  const { ctx: c } = ctx
  const high = inst.data.high as number | undefined
  const low = inst.data.low as number | undefined
  const startTime = inst.data.startTime as number | undefined
  const endTime = inst.data.endTime as number | undefined

  if (high == null || low == null || startTime == null || endTime == null) return

  const x1 = ctx.timeToPixel(startTime)
  const x2 = ctx.timeToPixel(endTime)
  if (x1 >= ctx.width || x2 <= 0) return

  const yHigh = ctx.priceToPixel(high)
  const yLow = ctx.priceToPixel(low)
  if ((yHigh < 0 && yLow < 0) || (yHigh > ctx.height && yLow > ctx.height)) return

  const left = Math.max(0, Math.min(x1, x2))
  const right = Math.min(ctx.width, Math.max(x1, x2))
  const top = Math.max(0, Math.min(yHigh, yLow))
  const bottom = Math.min(ctx.height, Math.max(yHigh, yLow))

  c.save()

  // Semi-transparent fill
  c.fillStyle = 'rgba(66, 165, 245, 0.08)'
  c.fillRect(left, top, right - left, bottom - top)

  // Border
  c.strokeStyle = '#42a5f5'
  c.lineWidth = 1
  c.setLineDash([3, 3])
  c.strokeRect(left, top, right - left, bottom - top)
  c.setLineDash([])

  // High / Low labels on both sides
  const labelStyle: Partial<PriceLineStyle> = {
    color: '#42a5f5',
    lineWidth: 1,
    lineDash: [4, 4],
    labelBg: '#42a5f5',
    labelText: '#ffffff',
    icon: '',
  }

  const highLabel = (inst.data.highLabel as string) ?? `H ${high.toFixed(2)}`
  const lowLabel = (inst.data.lowLabel as string) ?? `L ${low.toFixed(2)}`

  renderLine(ctx, yHigh, { ...DEFAULT_STYLE, ...labelStyle }, highLabel)
  renderLine(ctx, yLow, { ...DEFAULT_STYLE, ...labelStyle }, lowLabel)

  c.restore()
}

export const openingRangeDefinition: OverlayDefinition = {
  id: 'opening-range',
  name: 'Opening Range',
  category: 'session',
  render,
}
