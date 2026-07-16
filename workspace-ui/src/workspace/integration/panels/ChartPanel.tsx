/**
 * ChartPanel.tsx — Thin React host for ChartRuntime
 *
 * Minimal wrapper. Creates a ChartRuntime + ChartHost for the
 * workspace chart panel. No business logic, no state.
 *
 * @since 3.7.2
 */

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { ChartHost } from '../../chart/runtime/ChartHost'
import type { ChartConfig, SymbolInfo, TimeInterval, ChartType } from '../../chart/types'

/** Default symbol info */
const DEFAULT_SYMBOL: SymbolInfo = {
  ticker: 'BTC/USDT',
  exchange: 'BINANCE',
  base: 'BTC',
  quote: 'USDT',
}

/** Default chart config for a workspace panel */
const DEFAULT_CHART_CONFIG: ChartConfig = {
  id: `chart-panel-${Date.now()}`,
  chartType: 'candle' as ChartType,
  symbol: DEFAULT_SYMBOL,
  interval: '1h' as TimeInterval,
  viewport: { offsetX: 0, offsetY: 0, zoomX: 1, zoomY: 1 },
  timeScale: { visible: true, rangeMs: 86400000, from: 0, to: 0 },
  priceScale: { visible: true, position: 'right', inverted: false, logarithmic: false },
}

export interface ChartPanelProps {
  /** Optional chart configuration (defaults to BTC/USDT 1h) */
  config?: ChartConfig
  /** OHLCV data to render */
  data?: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>
}

/**
 * ChartPanel — thin React host for ChartRuntime.
 * Renders ChartHost inside a panel container.
 */
export function ChartPanel({ config, data }: ChartPanelProps): ReactNode {
  const chartConfig = useMemo(
    () => config ?? { ...DEFAULT_CHART_CONFIG, id: `chart-panel-${Date.now()}` },
    [config],
  )

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0d1117' }}>
      <ChartHost config={chartConfig} data={data} />
    </div>
  )
}
