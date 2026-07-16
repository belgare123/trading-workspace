// ── OverlayRenderer — CanvasLayer that renders all visible overlay instances ──
// Analogous to DrawingRenderer.
// Gets visible instances from OverlayRuntime, resolves definition, calls def.render().
// No hit-testing/interaction — rendering only.
//
// @since 3.3.6

import { CanvasLayer } from '../rendering/CanvasLayer'
import { OverlayRegistry } from './OverlayRegistry'
import { OverlayRuntime } from './OverlayRuntime'
import type { IRenderContext } from '../rendering/types'
import type { OverlayRenderContext } from './types'

export class OverlayRenderer extends CanvasLayer {
  readonly id = 'overlay'
  runtime: OverlayRuntime = new OverlayRuntime()

  initialize(_context: IRenderContext): void {
    // no-op: OverlayRenderer shares the main canvas
  }

  render(context: IRenderContext): void {
    const visible = this.runtime.getVisible()
    if (visible.length === 0) return

    // Build render context from IRenderContext
    const { ctx, viewport, width, height, dpr } = context
    const renderCtx: OverlayRenderContext = {
      ctx,
      timeToPixel: (t) => viewport.timeToPixel(t),
      priceToPixel: (p) => viewport.priceToPixel(p),
      pixelToTime: (x) => viewport.pixelToTime(x),
      pixelToPrice: (y) => viewport.pixelToPrice(y),
      width,
      height,
      dpr,
    }

    // Save/restore per-layer to contain style changes
    renderCtx.ctx.save()
    try {
      for (const inst of visible) {
        const def = OverlayRegistry.get(inst.definitionId)
        if (!def) continue
        def.render(renderCtx, inst)
      }
    } finally {
      renderCtx.ctx.restore()
    }
  }
}
