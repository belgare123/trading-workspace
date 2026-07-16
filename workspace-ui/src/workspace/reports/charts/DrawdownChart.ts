// ── DrawdownChartBuilder — Drawdown curve data ──
//
// @since 3.5.5

import type { ChartPoint, ChartData } from '../types'
import { buildLineChart } from './EquityChart'

export function buildDrawdownChart(points: ChartPoint[]): ChartData {
  return buildLineChart('drawdown', 'Drawdown', points)
}
