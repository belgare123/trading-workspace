// ── HeatmapChartBuilder — 2D parameter heatmap ──
//
// @since 3.5.5

import type { TrialResult } from '../../optimization/types'
import type { HeatmapData } from '../types'
import { buildHeatmap } from './EquityChart'

export function buildParameterHeatmap(
  trials: TrialResult[],
  paramX: string,
  paramY: string,
  scoreKey: string = 'net-profit',
): HeatmapData | null {
  const completed = trials.filter(t => t.status === 'completed' && t.metrics)
  if (completed.length < 4) return null

  const xValues = [...new Set(completed.map(t => String(t.parameters[paramX])))].sort()
  const yValues = [...new Set(completed.map(t => String(t.parameters[paramY])))].sort()
  const values = yValues.map(y =>
    xValues.map(x => {
      const match = completed.find(
        t => String(t.parameters[paramX]) === x && String(t.parameters[paramY]) === y,
      )
      return match?.metrics?.keyMetrics[scoreKey] ?? 0
    }),
  )

  return buildHeatmap(
    'parameter-heatmap',
    `${paramX} × ${paramY} — ${scoreKey}`,
    xValues,
    yValues,
    values,
  )
}
