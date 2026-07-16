// ── Interaction Engine barrel exports (Sprint 3.3.5) ──

export { InteractionRuntime } from './InteractionRuntime'
export { HitTestEngine } from './HitTestEngine'
export { SelectionManager } from './SelectionManager'
export { ToolController } from './ToolController'
export { DragController } from './DragController'
export { ResizeController } from './ResizeController'
export { CursorManager } from './CursorManager'
export { PointerRouter } from './PointerRouter'

export type { InteractionActions } from './PointerRouter'
export type {
  ToolMode,
  ResizeHandle,
  HitResult,
  PointerEventData,
  DrawingHitContext,
  InteractionConfig,
} from './types'

export { DEFAULT_HIT_THRESHOLD } from './types'
