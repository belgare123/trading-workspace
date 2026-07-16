// ── HeatmapData — 2D heatmap data for parameter sensitivity ──
//
// @since 3.5.4

import type { TrialResult } from '../types'

export interface HeatmapCell {
  xValue: unknown
  yValue: unknown
  score: number
  trialCount: number
}

export interface HeatmapData {
  xParam: string
  yParam: string
  xValues: unknown[]
  yValues: unknown[]
  cells: HeatmapCell[][]
}

export class HeatmapBuilder {
  /** Build heatmap for two parameters */
  build(
    trials: TrialResult[],
    xParam: string,
    yParam: string,
    scoreFn: (t: TrialResult) => number,
  ): HeatmapData {
    const xSet = new Set<unknown>()
    const ySet = new Set<unknown>()
    const map = new Map<string, { total: number; count: number }>()

    for (const t of trials) {
      if (t.status !== 'completed' || t.score === null) continue
      const xVal = t.parameters[xParam]
      const yVal = t.parameters[yParam]
      if (xVal === undefined || yVal === undefined) continue

      xSet.add(xVal)
      ySet.add(yVal)
      const key = `${xVal}|${yVal}`
      const entry = map.get(key) ?? { total: 0, count: 0 }
      entry.total += scoreFn(t)
      entry.count++
      map.set(key, entry)
    }

    const xValues = Array.from(xSet).sort((a, b) => String(a).localeCompare(String(b)))
    const yValues = Array.from(ySet).sort((a, b) => String(a).localeCompare(String(b)))

    const cells: HeatmapCell[][] = yValues.map(yVal =>
      xValues.map(xVal => {
        const key = `${xVal}|${yVal}`
        const entry = map.get(key)
        return {
          xValue: xVal,
          yValue: yVal,
          score: entry ? entry.total / entry.count : NaN,
          trialCount: entry?.count ?? 0,
        }
      }),
    )

    return { xParam, yParam, xValues, yValues, cells }
  }

  /** Format heatmap as text table */
  formatText(heatmap: HeatmapData, precision: number = 2): string {
    const lines: string[] = []
    const fmt = (v: number) => isNaN(v) ? ' '.repeat(precision + 4) : v.toFixed(precision).padStart(precision + 4)

    // Header
    lines.push(`Heatmap: ${heatmap.yParam} × ${heatmap.xParam}`)
    const header = ''.padStart(12) + heatmap.xValues.map(v => String(v).padStart(8)).join('')
    lines.push(header)

    // Rows
    for (let yi = 0; yi < heatmap.yValues.length; yi++) {
      const row = String(heatmap.yValues[yi]).padEnd(10) +
        heatmap.cells[yi].map(c => fmt(c.score)).join(' ')
      lines.push(row)
    }

    return lines.join('\n')
  }
}
