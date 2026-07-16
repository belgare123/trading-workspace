// ── MetricsTable — Key metrics table ──
//
// @since 3.5.5

import type { MetricValue } from '../../metrics/types'

export interface MetricsTableData {
  columns: { id: string; label: string; align?: 'left' | 'right' }[]
  rows: Record<string, string | number>[]
}

export function buildMetricsTable(metrics: MetricValue[]): MetricsTableData {
  return {
    columns: [
      { id: 'name', label: 'Metric', align: 'left' },
      { id: 'value', label: 'Value', align: 'right' },
      { id: 'category', label: 'Category', align: 'left' },
    ],
    rows: metrics.map(m => ({
      name: m.name,
      value: m.formatted,
      category: m.category,
    })),
  }
}
