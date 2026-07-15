/**
 * OperationHistory — stack of dock operations (foundation for undo/redo)
 *
 * @since 3.2.3
 */

import type { DockOperation, DockOperationType } from './types'

export interface OperationHistoryOptions {
  /** Max entries before pruning (default 200) */
  maxSize?: number
  /** Called when a new operation is recorded */
  onRecord?: (op: DockOperation, stack: DockOperation[]) => void
}

export class OperationHistory {
  private stack: DockOperation[] = []
  private maxSize: number
  private onRecord?: (op: DockOperation, stack: DockOperation[]) => void
  private counter = 0

  constructor(opts?: OperationHistoryOptions) {
    this.maxSize = opts?.maxSize ?? 200
    this.onRecord = opts?.onRecord
  }

  /** Record a new operation */
  record(type: DockOperationType, panelId: string, description: string, snapshot?: unknown): DockOperation {
    const op: DockOperation = {
      id: `op-${++this.counter}-${Date.now()}`,
      type,
      timestamp: Date.now(),
      panelId,
      description,
      ...(snapshot !== undefined ? { snapshot } : {}),
    }

    this.stack.push(op)

    // Prune if exceeding max size
    if (this.stack.length > this.maxSize) {
      this.stack.splice(0, this.stack.length - this.maxSize)
    }

    this.onRecord?.(op, this.stack)
    return op
  }

  /** Get all recorded operations */
  getAll(): DockOperation[] {
    return [...this.stack]
  }

  /** Get last N operations */
  getRecent(n: number): DockOperation[] {
    return this.stack.slice(-n)
  }

  /** Get operations by type */
  getByType(type: DockOperationType): DockOperation[] {
    return this.stack.filter(op => op.type === type)
  }

  /** Get operations for a specific panel */
  getByPanel(panelId: string): DockOperation[] {
    return this.stack.filter(op => op.panelId === panelId)
  }

  /** Clear all operations */
  clear(): void {
    this.stack = []
  }

  /** The last operation (for undo preview) */
  get last(): DockOperation | undefined {
    return this.stack[this.stack.length - 1]
  }

  /** Total recorded operations */
  get size(): number {
    return this.stack.length
  }

  /** Serialize for debug/inspection */
  toJSON(): unknown {
    return {
      size: this.stack.length,
      operations: this.stack.slice(-50), // last 50
    }
  }
}
