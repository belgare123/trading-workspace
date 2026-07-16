/**
 * ChartRegistry.ts — registry of active chart instances
 *
 * Tracks all active chart instances in the workspace.
 * Each chart is identified by its config id.
 *
 * Used by ChartRuntime to manage lifecycle and by
 * external consumers (panels, multi-chart views)
 * to enumerate available charts.
 *
 * @since 3.3.1
 */

import type { ChartConfig } from '../types'

export interface ChartInstance {
  id: string
  config: ChartConfig
  createdAt: number
}

/**
 * Registry of active chart instances.
 *
 * Charts are added when created and removed when destroyed.
 * The registry is the single source of truth for "which charts exist".
 */
export class ChartRegistry {
  private readonly _instances = new Map<string, ChartInstance>()

  /** Register a new chart instance */
  register(id: string, config: ChartConfig): ChartInstance {
    if (this._instances.has(id)) {
      console.warn(`[ChartRegistry] Overwriting existing chart '${id}'`)
    }
    const instance: ChartInstance = {
      id,
      config: { ...config },
      createdAt: Date.now(),
    }
    this._instances.set(id, instance)
    return instance
  }

  /** Unregister a chart instance */
  unregister(id: string): void {
    this._instances.delete(id)
  }

  /** Get a chart instance by id */
  get(id: string): ChartInstance | undefined {
    return this._instances.get(id)
  }

  /** All active chart instances */
  getAll(): ChartInstance[] {
    return Array.from(this._instances.values())
  }

  /** Number of active charts */
  get size(): number {
    return this._instances.size
  }

  /** Check if a chart id exists */
  has(id: string): boolean {
    return this._instances.has(id)
  }

  /** Update config for an existing chart */
  updateConfig(id: string, partial: Partial<ChartConfig>): void {
    const existing = this._instances.get(id)
    if (!existing) {
      console.warn(`[ChartRegistry] Cannot update unknown chart '${id}'`)
      return
    }
    existing.config = { ...existing.config, ...partial }
  }
}

// ── Singleton ──

export const chartRegistry = new ChartRegistry()
