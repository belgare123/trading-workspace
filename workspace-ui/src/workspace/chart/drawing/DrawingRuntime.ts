// ── DrawingRuntime — per-chart lifecycle manager for drawing instances ──
// Analogous to IndicatorRuntime.
// Manages add/remove/duplicate/clear + serialization + undo snapshots.

import { DrawingInstance } from './DrawingInstance'
import type { Anchor, DrawingStyle } from './types'

export class DrawingRuntime {
  private readonly _instances: DrawingInstance[] = []

  // ── Lifecycle ──

  /** Create and add a new instance from a definitionId + anchors + style */
  add(defId: string, anchors: Anchor[], style?: DrawingStyle): DrawingInstance {
    const inst = new DrawingInstance(defId, anchors, style ?? {})
    this._instances.push(inst)
    return inst
  }

  /** Add a pre-built instance (for deserialization) */
  addRaw(inst: DrawingInstance): void {
    this._instances.push(inst)
  }

  /** Remove an instance by id. Returns true if found and removed. */
  remove(id: string): boolean {
    const idx = this._instances.findIndex((i) => i.id === id)
    if (idx !== -1) {
      this._instances.splice(idx, 1)
      return true
    }
    return false
  }

  /** Duplicate an instance. Returns the new instance or undefined. */
  duplicate(id: string): DrawingInstance | undefined {
    const src = this._instances.find((i) => i.id === id)
    if (!src) return undefined
    const copy = src.clone()
    this._instances.push(copy)
    return copy
  }

  /** Remove all instances */
  clear(): void {
    this._instances.length = 0
  }

  // ── Queries ──

  /** Get an instance by id */
  get(id: string): DrawingInstance | undefined {
    return this._instances.find((i) => i.id === id)
  }

  /** Get all visible, unlocked instances (what the renderer iterates) */
  getVisible(): readonly DrawingInstance[] {
    return this._instances.filter((i) => i.visible && !i.locked)
  }

  /** Get all instances (including invisible/locked) */
  getAll(): readonly DrawingInstance[] {
    return this._instances
  }

  /** Number of instances */
  get count(): number {
    return this._instances.length
  }

  // ── Serialization ──

  /** Serialize all instances to a JSON-compatible structure */
  serialize(): SerializedDrawing[] {
    return this._instances.map((inst) => ({
      id: inst.id,
      definitionId: inst.definitionId,
      anchors: inst.anchors.map((a) => ({ time: a.time, price: a.price })),
      visible: inst.visible,
      locked: inst.locked,
      style: { ...inst.style },
      metadata: inst.metadata ? structuredClone(inst.metadata) : undefined,
    }))
  }

  /** Deserialize and replace all instances */
  deserialize(data: SerializedDrawing[]): void {
    this._instances.length = 0
    for (const d of data) {
      const inst = new DrawingInstance(d.definitionId, d.anchors, d.style, d.id)
      inst.visible = d.visible
      inst.locked = d.locked
      if (d.metadata) inst.metadata = structuredClone(d.metadata)
      this._instances.push(inst)
    }
  }

  // ── Undo snapshots ──

  private _snapshot: DrawingSnapshot | null = null

  /** Capture current state as an undo snapshot */
  captureSnapshot(): void {
    this._snapshot = {
      serialized: this.serialize(),
    }
  }

  /** Restore state from the captured snapshot. Returns true if a snapshot existed. */
  restoreSnapshot(): boolean {
    if (!this._snapshot) return false
    this.deserialize(this._snapshot.serialized)
    this._snapshot = null
    return true
  }

  /** Discard the snapshot without restoring */
  discardSnapshot(): void {
    this._snapshot = null
  }
}

// ── Types ──

export interface SerializedDrawing {
  id: string
  definitionId: string
  anchors: { time: number; price: number }[]
  visible: boolean
  locked: boolean
  style: DrawingStyle
  metadata?: Record<string, unknown>
}

interface DrawingSnapshot {
  serialized: SerializedDrawing[]
}
