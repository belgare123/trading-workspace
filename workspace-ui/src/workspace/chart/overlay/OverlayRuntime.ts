// ── OverlayRuntime — per-chart lifecycle manager for overlay instances ──
// Analogous to DrawingRuntime but simpler: no undo snapshots, no serialization.
// Instances are added/removed by runtime services (not users).
//
// @since 3.3.6

import { OverlayInstance } from './OverlayInstance'
import type { OverlayPosition } from './types'

export class OverlayRuntime {
  private readonly _instances: OverlayInstance[] = []

  // ── Lifecycle ──

  /** Create and add a new overlay instance */
  add(
    defId: string,
    position?: OverlayPosition,
    data?: Record<string, unknown>,
  ): OverlayInstance {
    const inst = new OverlayInstance(defId, position, data)
    this._instances.push(inst)
    return inst
  }

  /** Add a pre-built instance (for bulk loading) */
  addRaw(inst: OverlayInstance): void {
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

  /** Remove all instances */
  clear(): void {
    this._instances.length = 0
  }

  /** Remove all instances of a given definition type */
  clearByType(defId: string): void {
    for (let i = this._instances.length - 1; i >= 0; i--) {
      if (this._instances[i].definitionId === defId) {
        this._instances.splice(i, 1)
      }
    }
  }

  // ── Queries ──

  /** Get an instance by id */
  get(id: string): OverlayInstance | undefined {
    return this._instances.find((i) => i.id === id)
  }

  /** Get all visible instances, sorted by zIndex (ascending) */
  getVisible(): readonly OverlayInstance[] {
    return this._instances
      .filter((i) => i.visible)
      .sort((a, b) => a.zIndex - b.zIndex)
  }

  /** Get all instances (including invisible) */
  getAll(): readonly OverlayInstance[] {
    return this._instances
  }

  /** Get all instances of a specific overlay type */
  getByType(defId: string): readonly OverlayInstance[] {
    return this._instances.filter((i) => i.definitionId === defId)
  }

  /** Number of instances */
  get count(): number {
    return this._instances.length
  }

  // ── Batch Update ──

  /**
   * Replace all instances of a given type with a new set.
   * Useful for runtime services that recompute on every data tick.
   */
  replaceType(defId: string, instances: OverlayInstance[]): void {
    this.clearByType(defId)
    for (const inst of instances) {
      this._instances.push(inst)
    }
  }
}
