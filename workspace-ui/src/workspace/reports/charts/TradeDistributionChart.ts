// ── TradeDistributionChartBuilder — P/L histogram ──
//
// @since 3.5.5

import type { HistogramData } from '../types'
import { buildHistogram } from './EquityChart'

export function buildTradeDistributionChart(
  bins: { rangeMin: number; rangeMax: number; count: number }[],
): HistogramData {
  return buildHistogram('trade-distribution', 'Trade P/L Distribution', bins)
}
