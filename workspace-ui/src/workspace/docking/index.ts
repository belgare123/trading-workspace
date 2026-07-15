/**
 * index.ts — Dock Manager barrel export
 *
 * @since 3.2.3
 */

export type {
  DockZone,
  DockTarget,
  DockDragState,
  DockOperationType,
  DockOperation,
} from './types'

export {
  DOCK_EVENTS,
  EMPTY_DRAG_STATE,
} from './types'

export {
  PointerTracker,
} from './PointerTracker'

export type {
  PointerState,
  PointerTrackerOptions,
} from './PointerTracker'

export {
  hitTest,
  computePanelBounds,
} from './HitTesting'

export type {
  HitTestOptions,
  PanelBounds,
} from './HitTesting'

export {
  calculateZoneRect,
  snapPosition,
} from './SnapEngine'

export type {
  ZoneRect,
  SnapAlignment,
} from './SnapEngine'

export {
  DropResolver,
} from './DropResolver'

export type {
  DropResolution,
} from './DropResolver'

export {
  OperationHistory,
} from './OperationHistory'

export type {
  OperationHistoryOptions,
} from './OperationHistory'

export {
  DockController,
} from './DockController'

export type {
  DockControllerOptions,
  DockControllerState,
} from './DockController'

export {
  DockContextProvider,
  useDockController,
} from './DockContext'

export {
  DockManager,
} from './DockManager'

export {
  DockOverlay,
} from './DockOverlay'

export {
  DockPreview,
} from './DockPreview'

export {
  DockZones,
} from './DockZones'

export {
  DragGhost,
} from './DragGhost'
