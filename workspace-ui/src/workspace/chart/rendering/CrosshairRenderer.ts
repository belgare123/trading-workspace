/**
 * CrosshairRenderer.ts — crosshair cursor layer
 *
 * Renders a crosshair cursor at the current mouse position
 * with horizontal and vertical lines and axis labels.
 *
 * Rendered on the top layer (overlay), above candles and indicators.
 *
 * @since 3.3.2
 */

import { CanvasLayer } from './CanvasLayer'
import type { IRenderContext } from './types'
import { PriceScale } from '../viewport/PriceScale'
import { TimeScale } from '../viewport/TimeScale'

export interface CrosshairPosition {
  pixelX: number
  pixelY: number
  /** Timestamp at the crosshair position */
  timestamp: number
  /** Price at the crosshair position (Y coordinate) */
  price: number
  /** Whether the crosshair is visible */
  visible: boolean
}

export class CrosshairRenderer extends CanvasLayer {
  readonly id = 'crosshair'

  /** Current crosshair position (programmatically set by pointer events) */
  position: CrosshairPosition = {
    pixelX: 0,
    pixelY: 0,
    timestamp: 0,
    price: 0,
    visible: false,
  }

  /** Crosshair line color */
  lineColor = 'rgba(255, 255, 255, 0.25)'

  /** Crosshair line width */
  lineWidth = 1

  /** Label text color */
  labelColor = 'rgba(255, 255, 255, 0.7)'

  /** Label background */
  labelBg = 'rgba(26, 26, 46, 0.85)'

  render(context: IRenderContext): void {
    if (!this._ctx || !this.position.visible) return
    const ctx = this._ctx
    const { width, height, dpr } = context
    const { pixelX, pixelY, timestamp, price } = this.position

    // ── Vertical line ──
    ctx.strokeStyle = this.lineColor
    ctx.lineWidth = this.lineWidth
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(pixelX, 0)
    ctx.lineTo(pixelX, height)
    ctx.stroke()
    ctx.setLineDash([])

    // ── Horizontal line ──
    ctx.beginPath()
    ctx.moveTo(0, pixelY)
    ctx.lineTo(width, pixelY)
    ctx.stroke()

    // ── Time label (bottom) ──
    const fmt = TimeScale.defaultFormatters
    const timeLabel = fmt.full(timestamp)
    ctx.font = '11px Consolas, monospace'

    const timeLabelWidth = ctx.measureText(timeLabel).width
    const timeLabelX = pixelX - timeLabelWidth / 2 - 4
    const timeLabelY = height - 20 * dpr

    ctx.fillStyle = this.labelBg
    ctx.fillRect(timeLabelX, timeLabelY, timeLabelWidth + 8, 16)

    ctx.fillStyle = this.labelColor
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(timeLabel, timeLabelX + 4, timeLabelY + 2)

    // ── Price label (right) ──
    const priceLabel = PriceScale.defaultFormatter(price)
    const priceLabelWidth = ctx.measureText(priceLabel).width + 20
    const priceLabelX = width - priceLabelWidth - 4
    const priceLabelY = pixelY - 8

    ctx.fillStyle = this.labelBg
    ctx.fillRect(priceLabelX, priceLabelY, priceLabelWidth, 16)

    ctx.fillStyle = this.labelColor
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(priceLabel, priceLabelX + 4, priceLabelY + 2)
  }
}
