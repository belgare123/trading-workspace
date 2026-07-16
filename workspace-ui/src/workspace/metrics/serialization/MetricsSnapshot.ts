// ── MetricsSnapshot — Serializable state of Metrics Runtime ──
//
// @since 3.5.2

import type { MetricsReport, MetricValue, Curve } from '../types'

export interface MetricsSnapshot {
  version: string
  timestamp: number
  tradeCount: number
  equity: {
    start: number
    current: number
    peak: number
    maxDrawdown: number
  }
  keyMetrics: Record<string, number>
  reports: string[] // report IDs available
}

export function createSnapshot(
  tradeCount: number,
  metrics: MetricValue[],
  curves: Curve[],
  reports: MetricsReport[],
): MetricsSnapshot {
  const equityCurve = curves.find(c => c.id === 'equity-curve')
  const drawdownCurve = curves.find(c => c.id === 'drawdown-curve')

  const points = equityCurve?.points ?? []
  const start = points[0]?.value ?? 0
  const current = points[points.length - 1]?.value ?? 0
  const peak = Math.max(...points.map(p => p.value), 0)
  const maxDrawdown = drawdownCurve
    ? Math.max(...drawdownCurve.points.map(p => p.value), 0)
    : 0

  const keyMetrics: Record<string, number> = {}
  for (const m of metrics) {
    keyMetrics[m.id] = m.value
  }

  return {
    version: '3.5.2',
    timestamp: Date.now(),
    tradeCount,
    equity: { start, current, peak, maxDrawdown },
    keyMetrics,
    reports: reports.map(r => r.id),
  }
}
