// ── InitialBalanceOverlay — initial balance (first N minutes) rectangle ──
// Nearly identical visual pattern to OpeningRangeOverlay, but the calculation
// logic (data population) differs — Initial Balance captures the range from
// the first N minutes of the trading session.
//
// Data shape:
//   high: number           (IB high price)
//   low: number            (IB low price)
//   startTime: number      (epoch ms — session start)
//   endTime: number        (epoch ms — end of IB window)
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

  // Semi-transparent fill (slightly different colour from OpeningRange)
  c.fillStyle = 'rgba(171, 71, 188, 0.08)'
  c.fillRect(left, top, right - left, bottom - top)

  // Border
  c.strokeStyle = '#ab47bc'
  c.lineWidth = 1
  c.setLineDash([3, 3])
  c.strokeRect(left, top, right - left, bottom - top)
  c.setLineDash([])

  // High / Low labels
  const labelStyle: Partial<PriceLineStyle> = {
    color: '#ab47bc',
    lineWidth: 1,
    lineDash: [4, 4],
    labelBg: '#ab47bc',
    labelText: '#ffffff',
    icon: '',
  }

  const highLabel = (inst.data.highLabel as string) ?? `IB H ${high.toFixed(2)}`
  const lowLabel = (inst.data.lowLabel as string) ?? `IB L ${low.toFixed(2)}`

  renderLine(ctx, yHigh, { ...DEFAULT_STYLE, ...labelStyle }, highLabel)
  renderLine(ctx, yLow, { ...DEFAULT_STYLE, ...labelStyle }, lowLabel)

  c.restore()
}

export const initialBalanceDefinition: OverlayDefinition = {
  id: 'initial-balance',
  name: 'Initial Balance',
  category: 'session',
  render,
}
