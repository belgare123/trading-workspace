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

// ── State Machine ──

/** Possible controller states */
export type DockState =
  | 'idle'
  | 'pressed'
  | 'dragging'
  | 'hovering-target'
  | 'dropping'
  | 'cancelled'

/** Drag state during an active drag operation */
export interface DockDragState {
  active: boolean
  sourcePanelId: string | null
  currentTarget: DockTarget | null
  ghostPosition: { x: number; y: number }
  /** Mouse offset within the source panel (for smooth dragging) */
  offset: { x: number; y: number }
}

/** Initial drag state */
export const EMPTY_DRAG_STATE: DockDragState = {
  active: false,
  sourcePanelId: null,
  currentTarget: null,
  ghostPosition: { x: 0, y: 0 },
  offset: { x: 0, y: 0 },
}

// ── Layout Commands ──

import type { Panel, PanelPosition } from '../layout/types'

/** A command describing what LayoutEngine should do on drop */
export type LayoutCommand =
  | SplitCommand
  | DockCommand
  | FloatCommand
  | CloseCommand
  | MoveCommand

export interface SplitCommand {
  type: 'split'
  targetPanelId: string
  zone: 'left' | 'right' | 'top' | 'bottom'
  panel: Panel
}

export interface DockCommand {
  type: 'dock'
  targetPanelId: string
  sourcePanelId: string
  sourcePanel: Panel
}

export interface FloatCommand {
  type: 'float'
  panelId: string
}

export interface CloseCommand {
  type: 'close'
  panelId: string
}

export interface MoveCommand {
  type: 'move'
  panelId: string
  position: Partial<PanelPosition>
}

/** Result of executing a LayoutCommand */
export interface CommandResult {
  success: boolean
  operation: string
  description: string
}

// ── Unified Operation Model ──

/** Operation types recorded in history */
export type OperationType =
  | 'split'
  | 'dock'
  | 'float'
  | 'close'
  | 'move'
  | 'resize'
  | 'restore'

/** A single recorded operation with before/after snapshots */
export interface Operation {
  id: string
  type: OperationType
  timestamp: number
  command: LayoutCommand
  /** Deep-cloned panels BEFORE the operation (for undo) */
  before: Panel[]
  /** Deep-cloned panels AFTER the operation (for redo) */
  after: Panel[]
  /** Human-readable description */
  description: string
}

// ── Event Topics ──

/** Event topics published by Dock Manager */
export const DOCK_EVENTS = {
  DRAG_START: 'dock.drag.start',
  DRAG_MOVE: 'dock.drag.move',
  DRAG_ENTER: 'dock.drag.enter',
  DRAG_LEAVE: 'dock.drag.leave',
  DRAG_DROP: 'dock.drag.drop',
  LAYOUT_CHANGED: 'dock.layout.changed',
  STATE_CHANGED: 'dock.state.changed',
} as const
