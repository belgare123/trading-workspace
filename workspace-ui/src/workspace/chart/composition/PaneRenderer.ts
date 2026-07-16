// ── PaneRenderer — composite CanvasLayer for multi-pane chart ──
// Renders all panes in vertical stack, each with its own viewport,
// translated/clipped context, and sub-renderers.
// Single CanvasLayer in RenderLoop replaces all individual layers.
// @since 3.3.7

import { CanvasLayer } from '../rendering/CanvasLayer'
import type { IRenderContext } from '../rendering/types'
import { ChartViewport } from '../viewport/ChartViewport'
import type { GridRenderer } from '../rendering/GridRenderer'
import type { CandleRenderer } from '../rendering/CandleRenderer'
import type { IndicatorRuntime } from '../indicators/IndicatorRuntime'
import type { DrawingRenderer } from '../drawing/DrawingRenderer'
import type { OverlayRenderer } from '../overlay/OverlayRenderer'
import type { PaneRuntime } from './PaneRuntime'
import type { PaneLayout } from './PaneLayout'
import type { PaneLayoutRow, PaneState } from './types'
import type { SynchronizationRuntime } from './SynchronizationRuntime'

export interface PaneRendererOptions {
  paneRuntime: PaneRuntime
  paneLayout: PaneLayout
  syncRuntime: SynchronizationRuntime
  gridRenderer: GridRenderer
  candleRenderer?: CandleRenderer
  /** Per-pane indicator runtimes: paneId → indicator runtime */
  paneIndicatorRuntimes: Map<string, IndicatorRuntime>
  drawingRenderer?: DrawingRenderer
  overlayRenderer?: OverlayRenderer
}

export class PaneRenderer extends CanvasLayer {
  readonly id = 'composition'

  private readonly opts: PaneRendererOptions
  private readonly _paneViewports = new Map<string, ChartViewport>()

  /** Show/hide grid */
  showGrid = true

  constructor(opts: PaneRendererOptions) {
    super()
    this.opts = opts
  }

  render(context: IRenderContext): void {
    const { paneRuntime, paneLayout, syncRuntime } = this.opts
    const panes = paneRuntime.getAll()
    const rows = paneLayout.compute(panes, context.height, context.dpr)
    if (rows.length === 0) return

    const ctx = context.ctx
    const ch = syncRuntime.crosshair

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const pane = panes.find(p => p.id === row.paneId)
      if (!pane) continue

      // Save, translate to pane top, clip
      ctx.save()
      ctx.translate(0, row.y)
      ctx.beginPath()
      ctx.rect(0, 0, context.width, row.height)
      ctx.clip()

      // Pane viewport (shared TimeScale, per-pane PriceScale, pane height)
      const vp = this._getPaneViewport(pane.id, row, context)

      // Pane render context (y=0 is pane top)
      const paneCtx: IRenderContext = {
        ctx,
        viewport: vp,
        width: context.width,
        height: row.height,
        dpr: context.dpr,
        visibleData: context.visibleData,
      }

      // Pane background
      if (pane.definitionId !== 'main-chart') {
        ctx.fillStyle = 'rgba(255,255,255,0.015)'
        ctx.fillRect(0, 0, context.width, row.height)
      }

      // Grid
      if (this.showGrid) {
        this.opts.gridRenderer.render(paneCtx)
      }

      // Pane-specific content
      if (pane.definitionId === 'main-chart') {
        this._renderMainPane(pane, paneCtx)
      } else {
        this._renderSubPane(pane, paneCtx)
      }

      // Price labels (right edge)
      this._renderPriceLabels(paneCtx, pane)

      // Pane label (top-left)
      if (pane.definitionId !== 'main-chart') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.font = `${10 * context.dpr}px Consolas, monospace`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        const paneNames: Record<string, string> = {
          'rsi-pane': 'RSI (14)',
          'macd-pane': 'MACD (12, 26, 9)',
          default: pane.definitionId,
        }
        ctx.fillText(paneNames[pane.id] ?? paneNames.default, 6 * context.dpr, 4 * context.dpr)
      }

      // Crosshair (vertical line across all panes)
      if (ch.visible) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'
        ctx.lineWidth = 1
        const cx = vp.timeToPixel(ch.timestamp) + vp.viewport.offsetX
        ctx.beginPath()
        ctx.moveTo(cx, 0)
        ctx.lineTo(cx, row.height)
        ctx.stroke()
      }

      // Separator between panes
      if (i < rows.length - 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, row.height - 0.5)
        ctx.lineTo(context.width, row.height - 0.5)
        ctx.stroke()
      }

      ctx.restore()
    }
  }

  /** Main pane: candles + overlay indicators + drawings + overlays */
  private _renderMainPane(pane: PaneState, paneCtx: IRenderContext): void {
    this.opts.candleRenderer?.render(paneCtx)
    this._renderPaneIndicators(pane, paneCtx)
    this.opts.drawingRenderer?.render(paneCtx)
    this.opts.overlayRenderer?.render(paneCtx)
  }

  /** Sub pane: indicators only (RSI, MACD, etc.) */
  private _renderSubPane(pane: PaneState, paneCtx: IRenderContext): void {
    this._renderPaneIndicators(pane, paneCtx)
  }

  /** Render indicators for a specific pane from its runtime */
  private _renderPaneIndicators(pane: PaneState, paneCtx: IRenderContext): void {
    const rt = this.opts.paneIndicatorRuntimes.get(pane.id)
    if (!rt) return

    const active = rt.getActive()
    if (active.length === 0) return

    const data = paneCtx.visibleData
    if (!data || data.length === 0) return

    const ctx = paneCtx.ctx
    const { viewport } = paneCtx

    for (const instance of active) {
      const { definition, values } = instance
      const outputs = definition.outputs

      if (!values || values.length !== outputs.length) continue

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

  /** Render price labels on the right edge of a pane */
  private _renderPriceLabels(paneCtx: IRenderContext, _pane: PaneState): void {
    const ctx = paneCtx.ctx
    const vp = paneCtx.viewport
    const dpr = paneCtx.dpr
    const { fixedMin, fixedMax, visible } = vp.priceScale
    if (!visible || fixedMin === undefined || fixedMax === undefined) return

    const steps = 4
    const range = fixedMax - fixedMin
    const step = range / steps
    const rightX = paneCtx.width - 6 * dpr

    ctx.font = `${10 * dpr}px Consolas, monospace`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'

    for (let i = 0; i <= steps; i++) {
      const price = fixedMin + step * i
      const y = vp.priceToPixel(price)
      ctx.fillText(
        price.toFixed(2),
        rightX,
        y,
      )
    }
  }

  /** Cached per-pane ChartViewport */
  private _getPaneViewport(
    paneId: string,
    row: PaneLayoutRow,
    context: IRenderContext,
  ): ChartViewport {
    let vp = this._paneViewports.get(paneId)
    const priceScale = this.opts.syncRuntime.priceScales.get(paneId)
    if (!vp) {
      vp = new ChartViewport(
        this.opts.syncRuntime.viewport,
        this.opts.syncRuntime.timeScale,
        priceScale,
        context.width,
        row.height,
      )
      this._paneViewports.set(paneId, vp)
    } else {
      vp.setSize(context.width, row.height)
      vp.priceScale = priceScale
    }
    return vp
  }

  resize(width: number, height: number, dpr: number): void {
    super.resize(width, height, dpr)
  }

  destroy(): void {
    this._paneViewports.clear()
    super.destroy()
  }
}
