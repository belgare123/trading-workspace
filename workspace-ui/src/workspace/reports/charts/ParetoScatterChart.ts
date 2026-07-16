// ── ParetoScatterChartBuilder — Pareto front scatter plot ──
//
// @since 3.5.5

import type { ScatterData } from '../types'
import { buildScatter } from './EquityChart'

export function buildParetoScatterChart(
  points: { x: number; y: number; trialId: string }[],
): ScatterData {
  return buildScatter('pareto-front', 'Pareto Front', points)
}
