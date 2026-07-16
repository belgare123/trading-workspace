// ── DrawingRenderer — CanvasLayer that renders all visible drawing instances ──
// Analogous to IndicatorRenderer.
// Gets visible instances from DrawingRuntime, resolves definition, calls def.render().
// No hit-testing, no selection — rendering only.

import { CanvasLayer } from '../rendering/CanvasLayer'
import { DrawingRegistry } from './DrawingRegistry'
import { DrawingRuntime } from './DrawingRuntime'
import type { IRenderContext } from '../rendering/types'
import type { DrawingRenderContext } from './types'

export class DrawingRenderer extends CanvasLayer {
  readonly id = 'drawings'
  runtime: DrawingRuntime = new DrawingRuntime()

  initialize(_context: IRenderContext): void {
    // no-op: DrawingRenderer shares the main canvas
  }

  render(context: IRenderContext): void {
    const visible = this.runtime.getVisible()
    if (visible.length === 0) return

    // Build render context from IRenderContext
    const { ctx, viewport, width, height, dpr } = context
    const renderCtx: DrawingRenderContext = {
      ctx,
      timeToPixel: (t) => viewport.timeToPixel(t),
      priceToPixel: (p) => viewport.priceToPixel(p),
      width,
      height,
      dpr,
    }

    // Save/restore per-layer to contain style changes
    renderCtx.ctx.save()
    try {
      for (const inst of visible) {
        const def = DrawingRegistry.get(inst.definitionId)
        if (!def) continue

        // Apply instance opacity
        const opacity = inst.style.opacity ?? 1
        if (opacity < 1) {
          renderCtx.ctx.globalAlpha *= opacity
        }

        def.render(renderCtx, inst)

        // Restore per-instance style changes
        renderCtx.ctx.restore()
        renderCtx.ctx.save()
      }
    } finally {
      renderCtx.ctx.restore()
    }
  }
}
