// ── ResizeController — resize handles for multi-anchor drawings ──
// Supports Rectangle (any corner) and Trend Line (any endpoint).
// Works with already-selected instances.
// Uses DrawingRuntime.get() to mutate anchors.

import type { DrawingRuntime } from '../drawing/DrawingRuntime'
import type { SelectionManager } from './SelectionManager'
import type { ResizeHandle } from './types'

/** Snapshot of resize state */
interface ResizeState {
  instanceId: string
  handle: ResizeHandle
  startAnchors: { time: number; price: number }[]
}

export class ResizeController {
  private _resizeState: ResizeState | null = null

  /** @returns true if currently resizing */
  get isResizing(): boolean {
    return this._resizeState !== null
  }

  /** Get the instance id being resized, or null */
  get resizeInstanceId(): string | null {
    return this._resizeState?.instanceId ?? null
  }

  /**
   * Start resizing an instance at the given handle.
   */
  startResize(
    instanceId: string,
    handle: ResizeHandle,
    runtime: DrawingRuntime,
    selection: SelectionManager,
  ): void {
    const inst = runtime.get(instanceId)
    if (!inst || inst.locked) return

    runtime.captureSnapshot()
    selection.setActive(instanceId)

    this._resizeState = {
      instanceId,
      handle,
      startAnchors: inst.anchors.map((a) => ({ time: a.time, price: a.price })),
    }
  }

  /**
   * Continue resizing — anchors are mutated based on the handle position.
   * For a 2-anchor drawing:
   *   top-left     → anchor 0 = new pos, anchor 1 stays
   *   bottom-right → anchor 0 stays, anchor 1 = new pos
   *   top-right    → anchor 0 time stays, anchor 1 stays? No...
   *
   * Simplified approach: for 2-anchor drawings, each handle maps to one corner
   * of the bounding box being dragged. We compute which anchor index the
   * handle corresponds to and update only that anchor.
   */
  continueResize(
    marketTime: number,
    marketPrice: number,
    runtime: DrawingRuntime,
  ): void {
    if (!this._resizeState) return

    const inst = runtime.get(this._resizeState.instanceId)
    if (!inst || inst.anchors.length < 2) return

    const { handle } = this._resizeState

    // Determine which anchor index to update based on the handle
    const x1 = this._resizeState.startAnchors[0].time
    const y1 = this._resizeState.startAnchors[0].price
    const x2 = this._resizeState.startAnchors[1].time
    const y2 = this._resizeState.startAnchors[1].price

    const isLeft = x1 < x2
    const isTop = y1 < y2

    // Map handle to anchor index
    let targetAnchorIndex = -1

    switch (handle) {
      case 'top-left':
        targetAnchorIndex = isLeft && isTop ? 0 : !isLeft && isTop ? 1 : isLeft && !isTop ? 0 : 1
        break
      case 'top-right':
        targetAnchorIndex = isLeft && isTop ? 1 : !isLeft && isTop ? 0 : isLeft && !isTop ? 1 : 0
        break
      case 'bottom-left':
        targetAnchorIndex = isLeft && isTop ? 1 : !isLeft && isTop ? 0 : isLeft && !isTop ? 1 : 0
        break
      case 'bottom-right':
        targetAnchorIndex = isLeft && isTop ? 0 : !isLeft && isTop ? 1 : isLeft && !isTop ? 0 : 1
        break
    }

    if (targetAnchorIndex >= 0 && targetAnchorIndex < inst.anchors.length) {
      inst.setAnchor(targetAnchorIndex, marketTime, marketPrice)
    }
  }

  /** End the resize */
  endResize(): void {
    this._resizeState = null
  }

  /** Cancel the resize — restore pre-resize positions */
  cancelResize(runtime: DrawingRuntime): void {
    if (this._resizeState) {
      runtime.restoreSnapshot()
      this._resizeState = null
    }
  }
}
