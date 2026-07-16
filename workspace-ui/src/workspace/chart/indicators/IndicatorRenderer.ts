/**
 * IndicatorRenderer.ts — renders all active indicator instances
 *
 * A CanvasLayer that iterates IndicatorRuntime.getActive() and
 * draws each indicator's computed values on the main chart canvas.
 *
 * The chart does not know what SMA or RSI is — it only processes
 * whatever IndicatorInstance the runtime provides.
 *
 * For indicator values to be plotted correctly, the renderer needs
 * the original OHLCV timestamps (from context.visibleData) to map
 * each value index to an X pixel via ChartViewport.timeToPixel().
 *
 * @since 3.3.3
 */

import { CanvasLayer } from '../rendering/CanvasLayer'
import type { IRenderContext } from '../rendering/types'
import type { IndicatorRuntime } from './IndicatorRuntime'

export class IndicatorRenderer extends CanvasLayer {
  readonly id = 'indicators'

  /** Reference to the runtime that holds active instances */
  runtime: IndicatorRuntime | null = null

  constructor(runtime?: IndicatorRuntime) {
    super()
    if (runtime) this.runtime = runtime
  }

  /** Set or swap the runtime */
  setRuntime(runtime: IndicatorRuntime): void {
    this.runtime = runtime
  }

  render(context: IRenderContext): void {
    const rt = this.runtime
    if (!rt) return

    const active = rt.getActive()
    if (active.length === 0) return

    const data = context.visibleData
    if (!data || data.length === 0) return

    const ctx = context.ctx
    const { viewport } = context

    for (const instance of active) {
      const { definition, values } = instance
      const outputs = definition.outputs

      if (!values || values.length !== outputs.length) continue

      // Render indicator lines (overlay + subchart unified)
      // Each indicator uses the current viewport's price scale
      this._renderOverlay(ctx, viewport, data, values, outputs)
    }
  }

  /** Render overlay indicators (SMA, EMA, VWAP — plotted in price space) */
  private _renderOverlay(
    ctx: CanvasRenderingContext2D,
    viewport: import('../viewport/ChartViewport').ChartViewport,
    data: import('../types').OHLCV[],
    values: number[][],
    outputs: import('./IndicatorDefinition').IndicatorOutput[],
  ): void {
    for (let o = 0; o < outputs.length; o++) {
      const output = outputs[o]
      const line = values[o]
      if (!line || line.length !== data.length) continue

      ctx.strokeStyle = output.color
      ctx.lineWidth = output.lineWidth
      ctx.setLineDash(
        output.lineStyle === 'dashed' ? [6, 3] :
        output.lineStyle === 'dotted' ? [2, 3] : [],
      )

      ctx.beginPath()
      let started = false

      for (let i = 0; i < line.length; i++) {
        const val = line[i]
        if (isNaN(val) || val === null || val === undefined) {
          started = false
          continue
        }

        // Map timestamp to X, price to Y
        const px = viewport.timeToPixel(data[i].timestamp) + viewport.viewport.offsetX
        const py = viewport.priceToPixel(val)

        if (!started) {
          ctx.moveTo(px, py)
          started = true
        } else {
          ctx.lineTo(px, py)
        }
      }

      ctx.stroke()
      ctx.setLineDash([])
    }
  }
}
