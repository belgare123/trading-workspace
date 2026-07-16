/**
 * IndicatorInstance.ts — a running instance of an indicator
 *
 * Created by IndicatorRuntime when a user activates an indicator.
 * Holds the resolved parameters, cached computed values, and
 * a dirty flag for re-computation when data changes.
 *
 * @since 3.3.3
 */

import type { IndicatorDefinition } from './IndicatorDefinition'
import type { OHLCV } from '../types'

let _nextId = 1

export class IndicatorInstance {
  /** Unique instance id (e.g. 'sma_1', 'rsi_3') */
  readonly instanceId: string

  /** Reference to the static definition */
  readonly definition: IndicatorDefinition

  /** Resolved parameter values */
  params: Record<string, number>

  /** Cached computed values — one number[] per output (same length as data) */
  values: number[][] = []

  /** Whether values need re-computation */
  dirty = true

  /** Whether this instance is active (shown on chart) */
  active = true

  constructor(definition: IndicatorDefinition, params?: Partial<Record<string, number>>) {
    this.instanceId = `${definition.id}_${_nextId++}`
    this.definition = definition
    // Filter out undefined values from partial params
    const resolved: Record<string, number> = { ...definition.defaultParams }
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined) resolved[key] = val
      }
    }
    this.params = resolved
  }

  /** Recompute values from data */
  compute(data: OHLCV[]): void {
    this.values = this.definition.compute(data, this.params)
    this.dirty = false
  }

  /** Update a parameter value and mark dirty */
  setParam(name: string, value: number): void {
    this.params[name] = value
    this.dirty = true
  }
}
