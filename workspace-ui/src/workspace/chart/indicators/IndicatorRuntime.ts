/**
 * IndicatorRuntime.ts — per-chart lifecycle manager for indicator instances
 *
 * Manages active indicator instances for a single chart.
 * Provides:
 *   - add/remove/toggle instances
 *   - bulk re-computation when data changes
 *   - access to active instances for the IndicatorRenderer
 *
 * @since 3.3.3
 */

import type { OHLCV } from '../types'
import { IndicatorRegistry } from './IndicatorRegistry'
import { IndicatorInstance } from './IndicatorInstance'

export class IndicatorRuntime {
  /** All instances managed by this runtime (active + inactive) */
  private _instances = new Map<string, IndicatorInstance>()

  /** Last data set used for computation */
  private _lastData: OHLCV[] = []

  /**
   * Add an indicator instance by definition id.
   * @returns the new instance id
   */
  add(definitionId: string, params?: Partial<Record<string, number>>): string {
    const def = IndicatorRegistry.get(definitionId)
    if (!def) {
      throw new Error(`[IndicatorRuntime] Unknown indicator: '${definitionId}'`)
    }
    const instance = new IndicatorInstance(def, params)
    this._instances.set(instance.instanceId, instance)

    // Compute immediately if we have data
    if (this._lastData.length > 0) {
      instance.compute(this._lastData)
    }
    return instance.instanceId
  }

  /** Remove an instance by id */
  remove(instanceId: string): void {
    this._instances.delete(instanceId)
  }

  /** Toggle active state */
  toggle(instanceId: string): boolean {
    const inst = this._instances.get(instanceId)
    if (!inst) return false
    inst.active = !inst.active
    return inst.active
  }

  /** Get a specific instance */
  get(instanceId: string): IndicatorInstance | undefined {
    return this._instances.get(instanceId)
  }

  /** Get all active instances (for rendering) */
  getActive(): IndicatorInstance[] {
    return Array.from(this._instances.values()).filter((i) => i.active)
  }

  /** Get all instances */
  getAll(): IndicatorInstance[] {
    return Array.from(this._instances.values())
  }

  /** Recompute all dirty instances on new data */
  updateData(data: OHLCV[]): void {
    this._lastData = data
    for (const instance of this._instances.values()) {
      if (instance.dirty || data !== this._lastData) {
        instance.compute(data)
      }
    }
  }

  /** Recompute all instances (forced) */
  recomputeAll(data: OHLCV[]): void {
    this._lastData = data
    for (const instance of this._instances.values()) {
      instance.compute(data)
    }
  }

  /** Remove all instances */
  clear(): void {
    this._instances.clear()
  }

  /** Number of active instances */
  get activeCount(): number {
    return this.getActive().length
  }

  /** Total number of instances */
  get totalCount(): number {
    return this._instances.size
  }
}
