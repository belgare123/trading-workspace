/**
 * types.ts — foundational types for the Chart Studio subsystem
 *
 * All chart-domain types live here. No React, no workspace, no dashboard.
 *
 * @since 3.3.1
 */

// ── Chart kind ──

export const CHART_TYPES = {
  CANDLE: 'candle',
  LINE: 'line',
  AREA: 'area',
  BAR: 'bar',
  HEIKIN_ASHI: 'heikin_ashi',
  RENKO: 'renko',
  KAGI: 'kagi',
  PNF: 'point_and_figure',
} as const

export type ChartType = (typeof CHART_TYPES)[keyof typeof CHART_TYPES]

// ── Symbol ──

export interface SymbolInfo {
  ticker: string
  exchange?: string
  description?: string
  /** Base currency (e.g. 'BTC', 'USD') */
  base?: string
  /** Quote currency (e.g. 'USDT', 'USD') */
  quote?: string
  /** Price precision (decimal places) */
  pipSize?: number
  /** Minimum tick increment */
  minTick?: number
}

// ── Time / price scales ──

export type TimeInterval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h'
  | '1d' | '1w' | '1M'

export type ScalePosition = 'left' | 'right' | 'none'

export interface TimeScaleOptions {
  visible: boolean
  /** Initial time range extent in ms */
  rangeMs: number
  /** Earliest visible timestamp */
  from: number
  /** Latest visible timestamp */
  to: number
}

export interface PriceScaleOptions {
  visible: boolean
  position: ScalePosition
  /** Fixed min (optional — auto if omitted) */
  fixedMin?: number
  /** Fixed max (optional — auto if omitted) */
  fixedMax?: number
  /** Invert scale (for inverted pairs) */
  inverted: boolean
  /** Logarithmic scale */
  logarithmic: boolean
}

// ── Viewport ──

export interface ViewportState {
  /** Pixel offset of the viewport origin (negative = scrolled right) */
  offsetX: number
  /** Vertical scroll offset */
  offsetY: number
  /** Zoom multiplier (1.0 = 100%) */
  zoomX: number
  /** Vertical zoom */
  zoomY: number
}

// ── Chart config ──

export interface ChartConfig {
  /** Unique chart instance id */
  id: string
  /** Chart type (candle, line, …) */
  chartType: ChartType
  /** Symbol to display */
  symbol: SymbolInfo
  /** Time interval */
  interval: TimeInterval
  /** Time scale options */
  timeScale: TimeScaleOptions
  /** Price scale options */
  priceScale: PriceScaleOptions
  /** Viewport state */
  viewport: ViewportState
}

// ── Data point ──

export interface OHLCV {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ── Registry entries (lightweight) ──

export interface IndicatorMeta {
  id: string
  name: string
  description: string
  /** Number of required input series */
  inputs: number
  /** Number of output lines */
  outputs: number
}

export interface ToolMeta {
  id: string
  name: string
  description: string
  icon: string
}

export interface OverlayMeta {
  id: string
  name: string
  description: string
}

// ── Chart definition (registered chart type) ──

export interface ChartDefinition {
  type: ChartType
  name: string
  description: string
  /** True if this chart type needs full OHLCV (false = line-only) */
  requiresOHLCV: boolean
}

// ── Error types ──

export class ChartError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
    this.name = 'ChartError'
  }
}
