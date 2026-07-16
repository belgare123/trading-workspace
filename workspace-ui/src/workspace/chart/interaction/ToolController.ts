// ── ToolController — manages tool modes and instance creation ──
// When a drawing tool is active, the first click creates a DrawingInstance
// with the first anchor. Multi-anchor tools enter a "placing" state and
// finalise on the second click.

import { DrawingRegistry } from '../drawing/DrawingRegistry'
import type { DrawingRuntime } from '../drawing/DrawingRuntime'
import type { ToolMode } from './types'

export class ToolController {
  private _mode: ToolMode = 'select'

  /** Instance id being placed (multi-anchor tools) */
  private _placingId: string | null = null

  get mode(): ToolMode {
    return this._mode
  }

  /** Activate a tool mode */
  activate(mode: ToolMode): void {
    this._mode = mode
    this._placingId = null
  }

  /** @returns true if currently placing a multi-anchor drawing */
  get isPlacing(): boolean {
    return this._placingId !== null
  }

  /** Get the instance id currently being placed */
  get placingId(): string | null {
    return this._placingId
  }

  /**
   * Handle a click event on the chart canvas.
   * Creates or completes a drawing instance depending on tool mode.
   *
   * @returns the instance id affected, or null
   */
  handleClick(
    marketTime: number,
    marketPrice: number,
    runtime: DrawingRuntime,
  ): string | null {
    if (this._mode === 'select') return null

    const def = DrawingRegistry.get(this._mode)
    if (!def) return null

    // One-anchor tools: create and finalise in one click
    if (this._mode === 'horizontal-line' || this._mode === 'vertical-line' || this._mode === 'text') {
      const inst = runtime.add(this._mode, [{ time: marketTime, price: marketPrice }])
      // Capture snapshot for undo
      runtime.captureSnapshot()
      return inst.id
    }

    // Multi-anchor tools: first click creates, second click finalises
    if (!this._placingId) {
      // First click: create with the definition's create() helper
      // which sets a sensible default for the second anchor
      const inst = def.create({ time: marketTime, price: marketPrice })
      runtime.addRaw(inst)
      this._placingId = inst.id
      return inst.id
    }

    // Second click: update the second anchor to the clicked position
    const inst = runtime.get(this._placingId)
    if (inst && inst.anchors.length > 1) {
      inst.setAnchor(1, marketTime, marketPrice)
    }
    runtime.captureSnapshot()
    const id = this._placingId
    this._placingId = null
    return id
  }

  /** Cancel the current placement (e.g. on Escape) */
  cancelPlacement(runtime: DrawingRuntime): void {
    if (this._placingId) {
      runtime.remove(this._placingId)
      this._placingId = null
    }
  }
}
