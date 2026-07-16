// ── InteractionRuntime — orchestrator for all interaction services ──
// Owns the lifecycle of HitTestEngine, SelectionManager, ToolController,
// DragController, ResizeController, CursorManager, and PointerRouter.
// Does NOT contain business logic — delegates to the appropriate service.

import { HitTestEngine } from './HitTestEngine'
import { SelectionManager } from './SelectionManager'
import { ToolController } from './ToolController'
import { DragController } from './DragController'
import { ResizeController } from './ResizeController'
import { CursorManager } from './CursorManager'
import { PointerRouter } from './PointerRouter'
import type { InteractionActions } from './PointerRouter'
import type { ToolMode, DrawingHitContext, InteractionConfig } from './types'

export class InteractionRuntime {
  readonly hitTest: HitTestEngine
  readonly selection: SelectionManager
  readonly toolController: ToolController
  readonly drag: DragController
  readonly resize: ResizeController
  readonly cursor: CursorManager
  readonly router: PointerRouter

  constructor(config?: InteractionConfig) {
    const threshold = config?.hitThreshold
    this.hitTest = new HitTestEngine(threshold)
    this.selection = new SelectionManager()
    this.toolController = new ToolController()
    this.drag = new DragController()
    this.resize = new ResizeController()
    this.cursor = new CursorManager()
    this.router = new PointerRouter()
  }

  /** Connect the router to UI action callbacks */
  connect(actions: InteractionActions): void {
    this.router.connect(actions)
  }

  /** Activate a tool mode */
  activateTool(mode: ToolMode): void {
    this.toolController.activate(mode)
  }

  /** Get the current tool mode */
  get toolMode(): ToolMode {
    return this.toolController.mode
  }

  /** Reset all interaction state */
  reset(): void {
    this.selection.reset()
    this.cursor.reset()
    this.toolController.activate('select')
    this.drag.endDrag()
    this.resize.endResize()
  }

  /**
   * Build a DrawingHitContext from a viewport for hit-testing.
   * Convenience static for use in the UI layer.
   */
  static makeHitContext(
    timeToPixel: (time: number) => number,
    priceToPixel: (price: number) => number,
  ): DrawingHitContext {
    return { timeToPixel, priceToPixel }
  }
}
