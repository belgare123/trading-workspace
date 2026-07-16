// ── HitTestEngine — hit-testing against visible drawing instances ──
// Pure computation: iterates DrawingRuntime.getVisible(), delegates
// geometry checks to each DrawingDefinition.hitTest().
// MUST NOT perform selection, drag, or state mutation.

import { DrawingRegistry } from '../drawing/DrawingRegistry'
import type { DrawingRuntime } from '../drawing/DrawingRuntime'
import type { HitResult, DrawingHitContext } from './types'
import { DEFAULT_HIT_THRESHOLD } from './types'

export class HitTestEngine {
  private _threshold: number

  constructor(threshold = DEFAULT_HIT_THRESHOLD) {
    this._threshold = threshold
  }

  /** Set a new pixel distance threshold */
  setThreshold(px: number): void {
    this._threshold = px
  }

  /** Get the current pixel distance threshold */
  get threshold(): number {
    return this._threshold
  }

  /**
   * Hit-test all visible instances at the given pixel coordinate.
   * Returns the closest hit within the threshold, or null.
   */
  hitTest(
    pixelX: number,
    pixelY: number,
    runtime: DrawingRuntime,
    context: DrawingHitContext,
  ): HitResult | null {
    let best: HitResult | null = null
    const visible = runtime.getVisible()

    for (const inst of visible) {
      const def = DrawingRegistry.get(inst.definitionId)
      if (!def) continue

      const distance = def.hitTest({ x: pixelX, y: pixelY }, inst, context)
      if (distance === null || distance > this._threshold) continue

      // Check if it's close to an anchor point (for anchor dragging)
      let anchorIndex: number | undefined
      for (let i = 0; i < inst.anchors.length; i++) {
        const ax = context.timeToPixel(inst.anchors[i].time)
        const ay = context.priceToPixel(inst.anchors[i].price)
        const ad = Math.sqrt((pixelX - ax) ** 2 + (pixelY - ay) ** 2)
        if (ad <= this._threshold * 2) {
          anchorIndex = i
          break
        }
      }

      // Check resize handles for rectangle-style tools
      let handle: HitResult['handle'] | undefined
      if (inst.anchors.length === 2 && anchorIndex === undefined) {
        const x1 = context.timeToPixel(inst.anchors[0].time)
        const y1 = context.priceToPixel(inst.anchors[0].price)
        const x2 = context.timeToPixel(inst.anchors[1].time)
        const y2 = context.priceToPixel(inst.anchors[1].price)
        const left = Math.min(x1, x2)
        const right = Math.max(x1, x2)
        const top = Math.min(y1, y2)
        const bottom = Math.max(y1, y2)
        if (Math.sqrt((pixelX - left) ** 2 + (pixelY - top) ** 2) <= this._threshold * 2) handle = 'top-left'
        else if (Math.sqrt((pixelX - right) ** 2 + (pixelY - top) ** 2) <= this._threshold * 2) handle = 'top-right'
        else if (Math.sqrt((pixelX - left) ** 2 + (pixelY - bottom) ** 2) <= this._threshold * 2) handle = 'bottom-left'
        else if (Math.sqrt((pixelX - right) ** 2 + (pixelY - bottom) ** 2) <= this._threshold * 2) handle = 'bottom-right'
      }

      if (!best || distance < best.distance) {
        best = { instanceId: inst.id, distance, anchorIndex, handle }
      }
    }

    return best
  }
}
