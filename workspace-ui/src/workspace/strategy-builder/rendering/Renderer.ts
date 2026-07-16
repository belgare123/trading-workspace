// ── Renderer — Composite rendering pipeline ──
//
// Manages layer composition, dirty rect tracking, and
// frame-based rendering.
//
// @since 3.6.1

import type { ViewportState } from '../viewport/ViewportState'
import type { CanvasManager } from '../canvas/CanvasManager'
import type { BuilderEventBus } from '../runtime/BuilderEventBus'
import type { RenderFrame, Box2D } from '../types'

export interface LayerRenderer {
  readonly layerId: string
  render(ctx: CanvasRenderingContext2D, viewport: ViewportState, frame: RenderFrame): void
}

export class Renderer {
  private _layers: Map<string, LayerRenderer> = new Map()
  private _dirtyRects: Box2D[] = []
  private _frameId: number | null = null
  private _eventBus: BuilderEventBus | null = null
  private _viewport: ViewportState | null = null
  private _canvas: CanvasManager | null = null

  connect(eventBus: BuilderEventBus, viewport: ViewportState, canvas: CanvasManager): void {
    this._eventBus = eventBus
    this._viewport = viewport
    this._canvas = canvas
    eventBus.on('builder:viewport:changed', () => this.requestFrame())
    eventBus.on('builder:selection:changed', () => this.requestFrame())
  }

  registerLayer(renderer: LayerRenderer): void {
    this._layers.set(renderer.layerId, renderer)
  }

  unregisterLayer(layerId: string): void {
    this._layers.delete(layerId)
  }

  requestFrame(): void {
    if (this._frameId !== null) return
    this._frameId = requestAnimationFrame(() => this._render())
  }

  markDirty(rect: Box2D): void {
    this._dirtyRects.push(rect)
    this.requestFrame()
  }

  // ── Internal ──

  private _render(): void {
    this._frameId = null
    if (!this._viewport || !this._canvas) return

    const frame: RenderFrame = {
      timestamp: performance.now(),
      dirtyRects: this._dirtyRects.length > 0 ? this._dirtyRects : null,
      viewport: this._viewport.snapshot(),
    }

    const ctx = this._canvas.getContext()
    if (!ctx) return

    if (!frame.dirtyRects) {
      // Full redraw
      this._canvas.clearAll()
    } else {
      for (const rect of frame.dirtyRects) {
        ctx.clearRect(rect.x, rect.y, rect.width, rect.height)
      }
    }

    ctx.save()
    // Apply viewport transform
    ctx.translate(this._viewport.originX, this._viewport.originY)
    ctx.scale(this._viewport.zoom, this._viewport.zoom)
    ctx.translate(-this._viewport.originX, -this._viewport.originY)

    const sortedLayers = Array.from(this._layers.values())
      .sort((a, b) => this._getLayerIndex(a.layerId) - this._getLayerIndex(b.layerId))

    for (const layer of sortedLayers) {
      ctx.save()
      layer.render(ctx, this._viewport, frame)
      ctx.restore()
    }

    ctx.restore()

    this._dirtyRects = []
    this._eventBus?.emit('builder:rendered', frame)
  }

  private _getLayerIndex(layerId: string): number {
    const order = ['grid', 'edges', 'nodes', 'selection', 'marquee', 'overlay']
    const idx = order.indexOf(layerId)
    return idx >= 0 ? idx : order.length
  }
}
