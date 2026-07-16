/**
 * GridRenderer.ts — background grid layer
 *
 * Renders horizontal (price) and vertical (time) grid lines
 * on the chart background. Uses TimeScale and PriceScale to
 * compute tick positions.
 *
 * @since 3.3.2
 */

import { CanvasLayer } from './CanvasLayer'
import type { IRenderContext } from './types'
import { TimeScale } from '../viewport/TimeScale'
import { PriceScale } from '../viewport/PriceScale'

export class GridRenderer extends CanvasLayer {
  readonly id = 'grid'

  /** Grid line color */
  gridColor = 'rgba(255, 255, 255, 0.06)'

  /** Grid line width */
  gridWidth = 1

  /** Whether to show horizontal grid lines */
  showHorizontal = true

  /** Whether to show vertical grid lines */
  showVertical = true

  render(context: IRenderContext): void {
    if (!this._ctx) return
    const ctx = this._ctx
    const { viewport, width, height } = context

    ctx.strokeStyle = this.gridColor
    ctx.lineWidth = this.gridWidth

    // Vertical grid lines (time)
    if (this.showVertical) {
      const timeScale = new TimeScale(viewport.timeScale)
      const ticks = timeScale.getTicks(width, viewport.viewport.zoomX)

      ctx.beginPath()
      for (const tick of ticks) {
        ctx.moveTo(tick.pixelX, 0)
        ctx.lineTo(tick.pixelX, height)
      }
      ctx.stroke()
    }

    // Horizontal grid lines (price)
    if (this.showHorizontal) {
      const priceScale = new PriceScale(viewport.priceScale)
      const ticks = priceScale.getTicks(height, viewport.viewport.zoomY)

      ctx.beginPath()
      for (const tick of ticks) {
        ctx.moveTo(0, tick.pixelY)
        ctx.lineTo(width, tick.pixelY)
      }
      ctx.stroke()
    }
  }
}
