/**
 * OperationHistory — stack of operations with before/after snapshots
 *
 * Each operation records a deep-cloned Panel[] snapshot before and after
 * the operation, enabling future undo/redo, replay, and macro workflows.
 *
 * @since 3.2.3
 */

import type { Operation, OperationType, LayoutCommand } from './types'

export interface OperationHistoryOptions {
  /** Max entries before pruning (default 200) */
  maxSize?: number
  /** Called when a new operation is recorded */
  onRecord?: (op: Operation, stack: Operation[]) => void
}

export class OperationHistory {
  private stack: Operation[] = []
  /** Pointer for undo/redo. Points to the LAST applied operation. */
  private pointer = -1
  private maxSize: number
  private onRecord?: (op: Operation, stack: Operation[]) => void
  private counter = 0

  constructor(opts?: OperationHistoryOptions) {
    this.maxSize = opts?.maxSize ?? 200
    this.onRecord = opts?.onRecord
  }

  /**
   * Record a new operation.
   *
   * The `before` snapshot should be captured BEFORE the operation executes,
   * the `after` snapshot AFTER. The caller is responsible for deep-cloning.
   */
  record(
    type: OperationType,
    command: LayoutCommand,
    before: unknown[],
    after: unknown[],
    description: string,
  ): Operation {
    const op: Operation = {
      id: `op-${++this.counter}-${Date.now()}`,
      type,
      timestamp: Date.now(),
      command,
      before: before as any,
      after: after as any,
      description,
    }

    // If pointer is not at the end, truncate future history
    if (this.pointer < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.pointer + 1)
    }

    this.stack.push(op)
    this.pointer = this.stack.length - 1

    // Prune if exceeding max size
    if (this.stack.length > this.maxSize) {
      this.stack.splice(0, this.stack.length - this.maxSize)
      this.pointer = this.stack.length - 1
    }

    this.onRecord?.(op, this.stack)
    return op
  }

  // ── Undo / Redo — infrastructure ──

  /**
   * Get the operation to undo (the last applied one).
   * Returns `undefined` if nothing to undo or pointer is at the beginning.
   */
  get undoOp(): Operation | undefined {
    if (this.pointer < 0 || this.stack.length === 0) return undefined
    return this.stack[this.pointer]
  }

  /**
   * Get the operation to redo (the next one after pointer).
   * Returns `undefined` if nothing to redo.
   */
  get redoOp(): Operation | undefined {
    if (this.pointer >= this.stack.length - 1) return undefined
    return this.stack[this.pointer + 1]
  }

  /** Move undo pointer back (call AFTER undo is applied) */
  didUndo(): void {
    if (this.pointer >= 0) this.pointer--
  }

  /** Move redo pointer forward (call AFTER redo is applied) */
  didRedo(): void {
    if (this.pointer < this.stack.length - 1) this.pointer++
  }

  /** Whether undo is available */
  get canUndo(): boolean {
    return this.pointer >= 0
  }

  /** Whether redo is available */
  get canRedo(): boolean {
    return this.pointer < this.stack.length - 1
  }

  // ── Query ──

  /** Get all recorded operations */
  getAll(): Operation[] {
    return [...this.stack]
  }

  /** Get last N operations */
  getRecent(n: number): Operation[] {
    return this.stack.slice(-n)
  }

  /** Get operations by type */
  getByType(type: OperationType): Operation[] {
    return this.stack.filter(op => op.type === type)
  }

  /** Get operations for a specific panel */
  getByPanel(panelId: string): Operation[] {
    return this.stack.filter(op => op.command && 'panelId' in op.command && (op.command as any).panelId === panelId)
  }

  /** Clear all operations */
  clear(): void {
    this.stack = []
    this.pointer = -1
  }

  /** The last operation (for undo preview) */
  get last(): Operation | undefined {
    return this.stack[this.stack.length - 1]
  }

  /** Total recorded operations */
  get size(): number {
    return this.stack.length
  }

  /** Current undo pointer position */
  get currentPointer(): number {
    return this.pointer
  }

  /** Serialize for debug/inspection */
  toJSON(): unknown {
    return {
      size: this.stack.length,
      pointer: this.pointer,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      operations: this.stack.slice(-50).map(op => ({
        id: op.id,
        type: op.type,
        timestamp: op.timestamp,
        description: op.description,
      })),
    }
  }
}
