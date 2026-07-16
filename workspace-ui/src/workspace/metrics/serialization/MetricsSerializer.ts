// ── MetricsSerializer — Serialize/deserialize metrics state ──
//
// @since 3.5.2

import type { MetricsSnapshot } from './MetricsSnapshot'
import type { MetricsReport } from '../types'

export class MetricsSerializer {
  /** Serialize a full report set to JSON */
  serializeReports(reports: MetricsReport[]): string {
    return JSON.stringify(reports.map(r => ({
      id: r.id,
      name: r.name,
      timestamp: r.timestamp,
      metrics: r.metrics.map(m => ({
        id: m.id,
        name: m.name,
        value: m.value,
        formatted: m.formatted,
        category: m.category,
        metadata: m.metadata,
      })),
      curves: r.curves.map(c => ({
        id: c.id,
        name: c.name,
        points: c.points.map(p => ({
          timestamp: p.timestamp,
          value: p.value,
          label: p.label,
        })),
      })),
    })))
  }

  /** Deserialize a snapshot */
  deserialize(json: string): {
    reports: Partial<MetricsReport>[]
    snapshot: MetricsSnapshot
  } {
    const data = JSON.parse(json)
    return data
  }

  /** Export metrics as CSV (equity curve) */
  equityToCsv(equityPoints: { timestamp: number; value: number }[]): string {
    const header = 'timestamp,equity'
    const rows = equityPoints.map(p => `${p.timestamp},${p.value}`)
    return [header, ...rows].join('\n')
  }
}
