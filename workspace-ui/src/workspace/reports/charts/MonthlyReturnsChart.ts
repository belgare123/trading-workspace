// ── MonthlyReturnsChartBuilder — Monthly returns heatmap ──
//
// @since 3.5.5

import type { HeatmapData } from '../types'
import { buildHeatmap } from './EquityChart'

export function buildMonthlyReturnsChart(
  points: { timestamp: number; value: number }[],
): HeatmapData {
  const byYearMonth = new Map<string, number>()

  for (const p of points) {
    const d = new Date(p.timestamp)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    byYearMonth.set(key, (byYearMonth.get(key) ?? 0) + p.value)
  }

  const years = [...new Set([...byYearMonth.keys()].map(k => k.split('-')[0]))].sort()
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
  const values = years.map(year =>
    months.map(month => byYearMonth.get(`${year}-${month}`) ?? 0),
  )

  return buildHeatmap(
    'monthly-returns',
    'Monthly Returns',
    months.map(m => `'${m}`),
    years,
    values,
  )
}
