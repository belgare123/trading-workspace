/**
 * IndicatorRegistry.ts — registry of available technical indicators
 *
 * Indicators are registered at bootstrap or dynamically.
 * Each indicator has a meta descriptor (id, name, inputs, outputs).
 *
 * @since 3.3.1
 */

import type { IndicatorMeta } from '../types'

/**
 * In-memory registry of available indicators.
 */
export class IndicatorRegistry {
  private readonly _indicators = new Map<string, IndicatorMeta>()

  /** Register a single indicator */
  register(meta: IndicatorMeta): void {
    if (this._indicators.has(meta.id)) {
      console.warn(`[IndicatorRegistry] Overwriting indicator '${meta.id}'`)
    }
    this._indicators.set(meta.id, meta)
  }

  /** Register multiple indicators at once */
  registerAll(metas: IndicatorMeta[]): void {
    for (const meta of metas) {
      this.register(meta)
    }
  }

  /** Get indicator meta by id */
  get(id: string): IndicatorMeta | undefined {
    return this._indicators.get(id)
  }

  /** All registered indicators */
  getAll(): IndicatorMeta[] {
    return Array.from(this._indicators.values())
  }

  /** Check if an indicator id exists */
  has(id: string): boolean {
    return this._indicators.has(id)
  }

  /** Number of registered indicators */
  get size(): number {
    return this._indicators.size
  }
}

// ── Singleton ──

export const indicatorRegistry = new IndicatorRegistry()
