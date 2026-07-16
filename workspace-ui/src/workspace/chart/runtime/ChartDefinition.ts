/**
 * ChartDefinition.ts — registered chart type descriptor
 *
 * Each chart type (candle, line, heikin-ashi, …) registers a
 * definition that tells the runtime how to create and label it.
 *
 * @since 3.3.1
 */

import type { ChartType, ChartDefinition as ChartDef } from '../types'
import { CHART_TYPES } from '../types'

// ── Built-in definitions ──

const BUILT_IN_DEFINITIONS: ChartDef[] = [
  {
    type: CHART_TYPES.CANDLE,
    name: 'Candlestick',
    description: 'Standard Japanese candlestick chart (OHLCV)',
    requiresOHLCV: true,
  },
  {
    type: CHART_TYPES.LINE,
    name: 'Line',
    description: 'Simple line chart (close price)',
    requiresOHLCV: false,
  },
  {
    type: CHART_TYPES.AREA,
    name: 'Area',
    description: 'Filled line chart',
    requiresOHLCV: false,
  },
  {
    type: CHART_TYPES.BAR,
    name: 'Bar',
    description: 'OHLC bar chart',
    requiresOHLCV: true,
  },
  {
    type: CHART_TYPES.HEIKIN_ASHI,
    name: 'Heikin Ashi',
    description: 'Heikin-Ashi candlestick chart (smoothed)',
    requiresOHLCV: true,
  },
  {
    type: CHART_TYPES.RENKO,
    name: 'Renko',
    description: 'Renko brick chart (price movement, no time axis)',
    requiresOHLCV: true,
  },
  {
    type: CHART_TYPES.KAGI,
    name: 'Kagi',
    description: 'Kagi chart (price reversal, no time axis)',
    requiresOHLCV: true,
  },
  {
    type: CHART_TYPES.PNF,
    name: 'Point & Figure',
    description: 'Point & Figure chart (X and O columns)',
    requiresOHLCV: true,
  },
]

// ── Registry ──

/**
 * In-memory registry of available chart type definitions.
 * Chart types can be registered at bootstrap or dynamically.
 */
export class ChartDefinitionRegistry {
  private readonly _definitions = new Map<ChartType, ChartDef>()

  constructor() {
    // Register built-in types eagerly
    for (const def of BUILT_IN_DEFINITIONS) {
      this._definitions.set(def.type, def)
    }
  }

  /** Register a single chart type definition */
  register(def: ChartDef): void {
    if (this._definitions.has(def.type)) {
      console.warn(`[ChartDefinitionRegistry] Overwriting definition for '${def.type}'`)
    }
    this._definitions.set(def.type, def)
  }

  /** Get definition for a chart type */
  get(type: ChartType): ChartDef | undefined {
    return this._definitions.get(type)
  }

  /** All registered definitions */
  getAll(): ChartDef[] {
    return Array.from(this._definitions.values())
  }

  /** Check if a chart type is registered */
  has(type: ChartType): boolean {
    return this._definitions.has(type)
  }
}

// ── Singleton ──

export const chartDefinitionRegistry = new ChartDefinitionRegistry()
