/**
 * types.ts — Dock Manager type definitions
 *
 * @since 3.2.3
 */

/** Docking zone relative to a panel */
export type DockZone = 'left' | 'right' | 'top' | 'bottom' | 'center' | 'floating'

/** Target for a dock operation */
export interface DockTarget {
  panelId: string
  zone: DockZone
}

/** Drag state during an active drag operation */
export interface DockDragState {
  active: boolean
  sourcePanelId: string | null
  currentTarget: DockTarget | null
  ghostPosition: { x: number; y: number }
  /** Mouse offset within the source panel (for smooth dragging) */
  offset: { x: number; y: number }
}

/** Operation types recorded in history */
export type DockOperationType =
  | 'split'
  | 'move'
  | 'resize'
  | 'float'
  | 'dock'
  | 'close'
  | 'restore'

/** A single recorded operation */
export interface DockOperation {
  id: string
  type: DockOperationType
  timestamp: number
  panelId: string
  description: string
  /** Optional metadata for future undo/redo */
  snapshot?: unknown
}

/** Event topics published by Dock Manager */
export const DOCK_EVENTS = {
  DRAG_START: 'dock.drag.start',
  DRAG_MOVE: 'dock.drag.move',
  DRAG_ENTER: 'dock.drag.enter',
  DRAG_LEAVE: 'dock.drag.leave',
  DRAG_DROP: 'dock.drag.drop',
  LAYOUT_CHANGED: 'dock.layout.changed',
} as const

/** Initial drag state */
export const EMPTY_DRAG_STATE: DockDragState = {
  active: false,
  sourcePanelId: null,
  currentTarget: null,
  ghostPosition: { x: 0, y: 0 },
  offset: { x: 0, y: 0 },
}
