/**
 * UndoManager — connects OperationHistory to LayoutEngine
 *
 * Uses before/after snapshots from OperationHistory to implement
 * undo and redo via full-layout panel replacement.
 *
 * Architecture decision:
 *   OperationHistory stores Panel[] snapshots (before, after).
 *   UndoManager reconstructs a full WorkspaceLayout from the current
 *   layout by replacing its panels array with the snapshot.
 *   This avoids serializing the entire WorkspaceLayout for every operation
 *   while still providing atomic undo/redo via applySnapshot().
 *
 * @since 3.2.4
 */

import type { LayoutEngine } from '../layout/LayoutEngine'
import type { OperationHistory } from '../docking/OperationHistory'
import { cloneWorkspaceLayout } from '../layout/WorkspaceLayout'
import type { Panel } from '../layout/types'

export class UndoManager {
  private engine: LayoutEngine
  private history: OperationHistory

  constructor(engine: LayoutEngine, history: OperationHistory) {
    this.engine = engine
    this.history = history
  }

  /** Get underlying OperationHistory (for DockController to record into) */
  get operationHistory(): OperationHistory {
    return this.history
  }

  /**
   * Undo the last operation — restores the 'before' snapshot.
   *
   * Takes the current layout, replaces its panels with the before-snapshot,
   * and calls engine.applySnapshot() for atomic replacement.
   *
   * Returns true if undo succeeded, false if nothing to undo.
   */
  undo(): boolean {
    const op = this.history.undoOp
    if (!op) return false

    const current = this.engine.current
    const restoredLayout = cloneWorkspaceLayout(current)
    restoredLayout.panels = op.before as Panel[]

    this.engine.applySnapshot(restoredLayout)
    this.history.didUndo()
    return true
  }

  /**
   * Redo the last undone operation — restores the 'after' snapshot.
   *
   * Returns true if redo succeeded, false if nothing to redo.
   */
  redo(): boolean {
    const op = this.history.redoOp
    if (!op) return false

    const current = this.engine.current
    const restoredLayout = cloneWorkspaceLayout(current)
    restoredLayout.panels = op.after as Panel[]

    this.engine.applySnapshot(restoredLayout)
    this.history.didRedo()
    return true
  }

  /** Whether undo is available */
  get canUndo(): boolean {
    return this.history.canUndo
  }

  /** Whether redo is available */
  get canRedo(): boolean {
    return this.history.canRedo
  }

  /** Description of the next undo operation (for UI tooltips) */
  get undoDescription(): string | undefined {
    return this.history.undoOp?.description
  }

  /** Description of the next redo operation */
  get redoDescription(): string | undefined {
    return this.history.redoOp?.description
  }

  /** Clear operation history */
  clear(): void {
    this.history.clear()
  }
}
