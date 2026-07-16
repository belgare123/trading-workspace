// ── BalanceChartBuilder — Balance curve data ──
//
// @since 3.5.5

import type { ChartPoint, ChartData } from '../types'
import { buildLineChart } from './EquityChart'

export function buildBalanceChart(points: ChartPoint[]): ChartData {
  return buildLineChart('balance', 'Balance', points)
}
