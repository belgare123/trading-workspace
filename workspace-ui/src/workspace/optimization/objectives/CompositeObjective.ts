// ── CompositeObjective — Weighted combination of multiple objectives ──
//
// @since 3.5.4

import type { MetricsSnapshot } from '../../metrics/serialization/MetricsSnapshot'
import type { ObjectiveDefinition } from './ObjectiveDefinition'

export class CompositeObjective implements ObjectiveDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly higherIsBetter: boolean = true

  private _objectives: ObjectiveDefinition[]
  private _weights: Record<string, number>

  constructor(
    id: string,
    name: string,
    description: string,
    objectives: ObjectiveDefinition[],
    weights?: Record<string, number>,
  ) {
    this.id = id
    this.name = name
    this.description = description
    this._objectives = objectives
    this._weights = weights ?? {}

    // Default equal weights
    for (const obj of objectives) {
      if (this._weights[obj.id] === undefined) {
        this._weights[obj.id] = 1 / objectives.length
      }
    }
  }

  calculate(metrics: MetricsSnapshot): number | null {
    let score = 0
    let totalWeight = 0

    for (const obj of this._objectives) {
      const val = obj.calculate(metrics)
      if (val === null) continue

      const weight = this._weights[obj.id] ?? 1
      // Normalize: if lower is better, negate the value
      const normalized = obj.higherIsBetter ? val : -val
      score += weight * normalized
      totalWeight += weight
    }

    if (totalWeight === 0) return null
    return score / totalWeight
  }
}
