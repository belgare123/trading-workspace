/**
 * IndicatorDefinition.ts — indicator descriptor and computation contract
 *
 * Defines the structure of an indicator plugin. Each indicator exports
 * an id, metadata, input parameter schema, output line descriptors,
 * and a pure computation function.
 *
 * The chart never knows what SMA or RSI is — it only iterates over
 * active IndicatorInstances and calls their compute() → render() cycle.
 *
 * @since 3.3.3
 */

import type { OHLCV } from '../types'

/** Input parameter type */
export type IndicatorParamType = 'number' | 'select'

/** Describes a single input parameter */
export interface IndicatorParam {
  /** Parameter name (e.g. 'period', 'source', 'fastLength') */
  name: string
  /** Human-readable label */
  label: string
  /** Value type */
  type: IndicatorParamType
  /** Default value */
  default: number
  /** Possible values for 'select' type */
  options?: number[]
  /** Min/max for 'number' type */
  min?: number
  max?: number
  /** Step increment */
  step?: number
}

/** Describes a single output line */
export interface IndicatorOutput {
  /** Output name (e.g. 'sma', 'signal') */
  name: string
  /** Human-readable label */
  label: string
  /** Stroke color */
  color: string
  /** Line style */
  lineStyle: 'solid' | 'dashed' | 'dotted'
  /** Line width in pixels */
  lineWidth: number
}

/**
 * Indicator definition — meta + compute
 *
 * A pure descriptor. No runtime state.
 */
export interface IndicatorDefinition {
  /** Unique id (e.g. 'SMA', 'RSI', 'MACD') */
  id: string
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** Input parameter schema */
  params: IndicatorParam[]
  /** Output line descriptors */
  outputs: IndicatorOutput[]
  /** Default parameter values */
  defaultParams: Record<string, number>
  /** Whether this indicator overlays on the main chart (true) or renders in a subchart (false) */
  overlay: boolean
  /**
   * Core computation — pure function, no side effects.
   * @param data - OHLCV data array (sorted ascending by timestamp)
   * @param params - resolved parameter values
   * @returns array of number[] — one per output (same length as data, NaN for undefined values)
   */
  compute: (data: OHLCV[], params: Record<string, number>) => number[][]
}
