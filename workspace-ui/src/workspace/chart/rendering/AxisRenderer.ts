/**
 * AxisRenderer.ts — time (bottom) and price (right) axis renderer
 *
 * Draws tick labels and axis lines on the chart edges.
 * Uses TimeScale and PriceScale for tick computation.
 *
 * @since 3.3.2
 */

import { CanvasLayer } from './CanvasLayer'
import type { IRenderContext } from './types'
import { TimeScale } from '../viewport/TimeScale'
import { PriceScale } from '../viewport/PriceScale'

export interface AxisRendererOptions {
  /** Height of the bottom time axis in pixels */
  timeAxisHeight: number
  /** Width of the right price axis in pixels */
  priceAxisWidth: number
  /** Font family for labels */
  fontFamily: string
  /** Font size in pixels */
  fontSize: number
  /** Text color */
  textColor: string
  /** Axis line color */
  axisColor: string
  /** Background color for axis areas */
  backgroundColor: string
}

const DEFAULT_OPTIONS: AxisRendererOptions = {
  timeAxisHeight: 28,
  priceAxisWidth: 60,
  fontFamily: 'Consolas, monospace',
  fontSize: 11,
  textColor: 'rgba(255, 255, 255, 0.5)',
  axisColor: 'rgba(255, 255, 255, 0.1)',
  backgroundColor: '#16162a',
}

export class AxisRenderer extends CanvasLayer {
  readonly id = 'axis'

  options: AxisRendererOptions

  constructor(options?: Partial<AxisRendererOptions>) {
    super()
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  render(context: IRenderContext): void {
    if (!this._ctx) return
    const ctx = this._ctx
    const { viewport, width, height, dpr } = context
    const { timeAxisHeight, priceAxisWidth, fontFamily, fontSize, textColor, axisColor, backgroundColor } = this.options

    const cssWidth = width / dpr
    const cssHeight = height / dpr

    const effectiveWidth = cssWidth - priceAxisWidth
    const effectiveHeight = cssHeight - timeAxisHeight

    // ── Time axis (bottom) ──
    if (timeAxisHeight > 0) {
      const y = effectiveHeight * dpr
      const h = timeAxisHeight * dpr

      // Background
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, y, width - priceAxisWidth * dpr, h)

      // Top border
      ctx.strokeStyle = axisColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width - priceAxisWidth * dpr, y)
      ctx.stroke()

      // Tick labels
      const timeScale = new TimeScale(viewport.timeScale)
      const ticks = timeScale.getTicks(cssWidth - priceAxisWidth, viewport.viewport.zoomX)

      ctx.fillStyle = textColor
      ctx.font = `${fontSize}px ${fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      for (const tick of ticks) {
        const labelWidth = ctx.measureText(tick.label).width
        // Skip if offscreen
        if (tick.pixelX < -labelWidth || tick.pixelX > effectiveWidth + labelWidth) continue
        ctx.fillText(tick.label, tick.pixelX, y + 4 * dpr)
      }
    }

    // ── Price axis (right) ──
    if (priceAxisWidth > 0) {
      const x = effectiveWidth * dpr
      const w = priceAxisWidth * dpr

      // Background
      ctx.fillStyle = backgroundColor
      ctx.fillRect(x, 0, w, height - timeAxisHeight * dpr)

      // Left border
      ctx.strokeStyle = axisColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height - timeAxisHeight * dpr)
      ctx.stroke()

      // Tick labels
      const priceScale = new PriceScale(viewport.priceScale)
      const ticks = priceScale.getTicks(cssHeight - timeAxisHeight, viewport.viewport.zoomY)

      ctx.fillStyle = textColor
      ctx.font = `${fontSize}px ${fontFamily}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'

      for (const tick of ticks) {
        if (tick.pixelY < -10 || tick.pixelY > effectiveHeight + 10) continue
        ctx.fillText(tick.label, width - 4 * dpr, tick.pixelY)
      }
    }
  }
}
