// ── ObjectiveDefinition — Base interface for objective functions ──
//
// @since 3.5.4

import type { MetricsSnapshot } from '../../metrics/serialization/MetricsSnapshot'

export interface ObjectiveDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly higherIsBetter: boolean
  calculate(metrics: MetricsSnapshot): number | null
}

/** Validate that a snapshot has the required fields for an objective */
export function requireMetric(snapshot: MetricsSnapshot, key: string, _label?: string): number | null {
  const val = snapshot.keyMetrics[key]
  if (val === undefined || val === null) return null
  return val
}
