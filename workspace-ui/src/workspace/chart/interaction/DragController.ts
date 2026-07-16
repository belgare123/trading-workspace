// ── DragController — moves/drags selected drawing instances ──
// Works with already-selected instances.
// Translates pointer delta into anchor market-coordinate changes
// via DrawingRuntime.get().

import type { DrawingRuntime } from '../drawing/DrawingRuntime'
import type { SelectionManager } from './SelectionManager'
import type { DrawingHitContext } from './types'

/** Snapshot of drag state for a single instance */
interface DragState {
  instanceId: string
  anchorSnapshots: { time: number; price: number }[]
  /** Market coordinates at pointer-down time (for delta tracking) */
  startTime: number
  startPrice: number
}

export class DragController {
  private _dragState: DragState | null = null

  /** @returns true if currently dragging */
  get isDragging(): boolean {
    return this._dragState !== null
  }

  /** Get the instance id being dragged, or null */
  get dragInstanceId(): string | null {
    return this._dragState?.instanceId ?? null
  }

  /**
   * Start dragging a single instance.
   * Captures the anchor positions as a baseline.
   */
  startDrag(
    instanceId: string,
    runtime: DrawingRuntime,
    selection: SelectionManager,
    startMarketTime: number,
    startMarketPrice: number,
    _context: DrawingHitContext,
  ): void {
    const inst = runtime.get(instanceId)
    if (!inst || inst.locked) return

    // Capture snapshot before drag
    runtime.captureSnapshot()

    selection.setActive(instanceId)
    this._dragState = {
      instanceId,
      anchorSnapshots: inst.anchors.map((a) => ({ time: a.time, price: a.price })),
      startTime: startMarketTime,
      startPrice: startMarketPrice,
    }
  }

  /**
   * Continue dragging — translate by the delta from pointer-down position.
   * Current mouse position is passed directly; delta is computed from the
   * pointer-down position captured in startDrag().
   */
  continueDrag(
    currentTime: number,
    currentPrice: number,
    runtime: DrawingRuntime,
  ): void {
    if (!this._dragState) return

    const deltaTime = currentTime - this._dragState.startTime
    const deltaPrice = currentPrice - this._dragState.startPrice

    const inst = runtime.get(this._dragState.instanceId)
    if (!inst) return

    for (let i = 0; i < inst.anchors.length; i++) {
      const base = this._dragState.anchorSnapshots[i]
      if (base) {
        inst.setAnchor(i, base.time + deltaTime, base.price + deltaPrice)
      }
    }
  }

  /** End the drag — commit the final positions */
  endDrag(): void {
    this._dragState = null
  }

  /** Cancel the drag — restore pre-drag positions */
  cancelDrag(runtime: DrawingRuntime): void {
    if (this._dragState) {
      runtime.restoreSnapshot()
      this._dragState = null
    }
  }
}
