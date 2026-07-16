// ── UndoAdapter — StrategyGraph snapshot-based undo/redo ──
//
// Bridges graph editing to the platform's undo/redo pattern.
// Stores StrategyGraph snapshots (before, after) per operation.
// Does NOT implement its own history stack — uses a simple
// snapshot+redo stack for graph-local operations.
//
// The platform's UndoManager (workspace-level) can be plugged in
// for cross-panel undo integration.
//
// @since 3.6.3

import type { StrategyGraph } from '../../strategy/composition/types'

export interface GraphUndoEntry {
  label: string
  before: string  // JSON snapshot before operation
  after: string   // JSON snapshot after operation
  timestamp: number
}

export class UndoAdapter {
  private _undoStack: GraphUndoEntry[] = []
  private _redoStack: GraphUndoEntry[] = []
  private _maxEntries: number = 50

  constructor(maxEntries?: number) {
    if (maxEntries) this._maxEntries = maxEntries
  }

  /** Take a snapshot of the current graph state */
  snapshot(graph: StrategyGraph): string {
    return JSON.stringify(graph)
  }

  /** Record a completed operation */
  record(label: string, before: string, after: string): void {
    this._undoStack.push({ label, before, after, timestamp: Date.now() })
    if (this._undoStack.length > this._maxEntries) {
      this._undoStack.shift()
    }
    // New operation clears redo stack
    this._redoStack = []
  }

  /** Undo last operation — returns the 'before' snapshot */
  undo(): { label: string; snapshot: string } | null {
    const entry = this._undoStack.pop()
    if (!entry) return null
    this._redoStack.push(entry)
    return { label: entry.label, snapshot: entry.before }
  }

  /** Redo last undone operation — returns the 'after' snapshot */
  redo(): { label: string; snapshot: string } | null {
    const entry = this._redoStack.pop()
    if (!entry) return null
    this._undoStack.push(entry)
    return { label: entry.label, snapshot: entry.after }
  }

  /** Can undo */
  get canUndo(): boolean {
    return this._undoStack.length > 0
  }

  /** Can redo */
  get canRedo(): boolean {
    return this._redoStack.length > 0
  }

  /** Label of the top undo entry */
  get undoLabel(): string | null {
    return this._undoStack.length > 0 ? this._undoStack[this._undoStack.length - 1].label : null
  }

  /** Label of the top redo entry */
  get redoLabel(): string | null {
    return this._redoStack.length > 0 ? this._redoStack[this._redoStack.length - 1].label : null
  }

  /** Clear all history */
  clear(): void {
    this._undoStack = []
    this._redoStack = []
  }

  /** Undo stack depth */
  get depth(): number {
    return this._undoStack.length
  }
}
