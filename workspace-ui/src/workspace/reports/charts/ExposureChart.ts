// ── ExposureChartBuilder — Exposure curve data ──
//
// @since 3.5.5

import type { ChartPoint, ChartData } from '../types'
import { buildLineChart } from './EquityChart'

export function buildExposureChart(points: ChartPoint[]): ChartData {
  return buildLineChart('exposure', 'Exposure', points)
}
