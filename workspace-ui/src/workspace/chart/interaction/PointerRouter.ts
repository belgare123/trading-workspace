// ── PointerRouter — mediates DOM pointer events → Interaction Engine ──
// Decouples the Interaction Engine from DOM/React event handling.
// Routes events based on current tool mode and selection state.

import type { ToolMode, PointerEventData, DrawingHitContext } from './types'
import type { HitResult } from './types'
import type { DrawingRuntime } from '../drawing/DrawingRuntime'
import type { HitTestEngine } from './HitTestEngine'
import type { SelectionManager } from './SelectionManager'
import type { ToolController } from './ToolController'
import type { DragController } from './DragController'
import type { ResizeController } from './ResizeController'
import type { CursorManager } from './CursorManager'

/** Actions dispatched by the PointerRouter back to the UI layer */
export interface InteractionActions {
  /** Request a cursor change */
  setCursor: (cursor: string) => void
  /** Request a re-render */
  requestRender: () => void
  /** Set the hovered state on the drawing instance */
  setHovered: (instanceId: string | null) => void
}

export class PointerRouter {
  private _actions: InteractionActions | null = null
  private _lastHitResult: HitResult | null = null

  /** Connect the router to the UI callback actions */
  connect(actions: InteractionActions): void {
    this._actions = actions
  }

  /** Get the most recent hit result (for cursor management) */
  get lastHitResult(): HitResult | null {
    return this._lastHitResult
  }

  /**
   * Handle a pointer down event.
   * Returns true if the event was consumed by the interaction engine.
   */
  pointerDown(
    event: PointerEventData,
    mode: ToolMode,
    runtime: DrawingRuntime,
    hitEngine: HitTestEngine,
    selection: SelectionManager,
    toolController: ToolController,
    dragController: DragController,
    resizeController: ResizeController,
    context: DrawingHitContext,
  ): boolean {
    if (mode !== 'select') {
      // Drawing tool active — route to ToolController for creation
      toolController.handleClick(event.marketTime, event.marketPrice, runtime)
      this._actions?.requestRender()
      return true
    }

    // Select mode — hit-test and route to drag/resize
    const hit = hitEngine.hitTest(event.pixelX, event.pixelY, runtime, context)
    this._lastHitResult = hit

    if (!hit) {
      // Clicked empty space → clear selection
      selection.clearSelection()
      selection.setActive(null)
      this._actions?.requestRender()
      return true
    }

    // Hit an instance
    selection.select(hit.instanceId)

    if (hit.handle !== undefined) {
      // Start resize
      resizeController.startResize(hit.instanceId, hit.handle, runtime, selection)
    } else {
      // Start drag — pass pointer-down position for delta tracking
      dragController.startDrag(hit.instanceId, runtime, selection, event.marketTime, event.marketPrice, context)
    }

    this._actions?.requestRender()
    return true
  }

  /**
   * Handle a pointer move event.
   * Updates hover state, drag/resize, and cursor.
   */
  pointerMove(
    event: PointerEventData,
    mode: ToolMode,
    runtime: DrawingRuntime,
    hitEngine: HitTestEngine,
    selection: SelectionManager,
    dragController: DragController,
    resizeController: ResizeController,
    cursorManager: CursorManager,
    context: DrawingHitContext,
  ): void {
    const hit = hitEngine.hitTest(event.pixelX, event.pixelY, runtime, context)
    this._lastHitResult = hit

    // Update hover
    const hoverId = hit?.instanceId ?? null
    if (selection.hoveredId !== hoverId) {
      selection.setHover(hoverId)
      this._actions?.setHovered(hoverId)
    }

    // Continue drag or resize using delta from pointer-down position
    if (dragController.isDragging) {
      dragController.continueDrag(event.marketTime, event.marketPrice, runtime)
    } else if (resizeController.isResizing && selection.activeId) {
      resizeController.continueResize(event.marketTime, event.marketPrice, runtime)
    }

    // Update cursor
    cursorManager.compute(mode, hit, selection)
    this._actions?.setCursor(cursorManager.cssValue)
    this._actions?.requestRender()
  }

  /**
   * Handle a pointer up event.
   * Ends drag or resize.
   */
  pointerUp(
    dragController: DragController,
    resizeController: ResizeController,
  ): void {
    dragController.endDrag()
    resizeController.endResize()
  }

  /** Handle pointer leave (end hover, reset cursor) */
  pointerLeave(
    selection: SelectionManager,
    cursorManager: CursorManager,
  ): void {
    selection.setHover(null)
    cursorManager.reset()
    this._actions?.setCursor(cursorManager.cssValue)
    this._actions?.setHovered(null)
  }
}
