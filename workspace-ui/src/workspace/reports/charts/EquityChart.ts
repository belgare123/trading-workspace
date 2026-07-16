// ── Chart builders — transform section data to chart-ready formats ──
//
// Each builder is a pure function. No computation.
//
// @since 3.5.5

import type { ChartPoint, ChartData, BarChartData, HistogramData, ScatterData, HeatmapData } from '../types'

export function buildLineChart(id: string, name: string, points: ChartPoint[]): ChartData {
  return { id, name, points }
}

export function buildBarChart(id: string, name: string, bars: { label: string; value: number; color?: string }[]): BarChartData {
  return { id, name, bars }
}

export function buildHistogram(id: string, name: string, bins: { rangeMin: number; rangeMax: number; count: number }[]): HistogramData {
  return { id, name, bins }
}

export function buildScatter(id: string, name: string, points: { x: number; y: number; label?: string; size?: number }[]): ScatterData {
  return { id, name, points }
}

export function buildHeatmap(id: string, name: string, xLabels: string[], yLabels: string[], values: number[][]): HeatmapData {
  return { id, name, xLabels, yLabels, values }
}
