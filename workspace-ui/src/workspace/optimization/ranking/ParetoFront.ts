// ── ParetoFront — Multi-objective Pareto frontier ──
//
// Identifies non-dominated trials across multiple objectives.
//
// @since 3.5.4

import type { TrialResult, ParetoFrontEntry, ObjectiveDefinition } from '../types'

export class ParetoFront {
  /** Compute Pareto frontier for a set of objectives */
  compute(
    trials: TrialResult[],
    objectives: ObjectiveDefinition[],
  ): ParetoFrontEntry[] {
    const scored = trials
      .filter(t => t.status === 'completed' && t.metrics !== null)
      .map(t => ({
        trialId: t.trialId,
        parameters: t.parameters,
        scores: this._computeScores(t, objectives),
        isDominated: false,
      }))

    // Check dominance
    for (let i = 0; i < scored.length; i++) {
      for (let j = 0; j < scored.length; j++) {
        if (i === j) continue
        if (this._dominates(scored[j].scores, scored[i].scores, objectives)) {
          scored[i].isDominated = true
          break
        }
      }
    }

    return scored
  }

  /** Get non-dominated (Pareto-optimal) entries */
  front(
    trials: TrialResult[],
    objectives: ObjectiveDefinition[],
  ): ParetoFrontEntry[] {
    return this.compute(trials, objectives).filter(e => !e.isDominated)
  }

  private _computeScores(
    trial: TrialResult,
    objectives: ObjectiveDefinition[],
  ): Record<string, number> {
    const scores: Record<string, number> = {}
    for (const obj of objectives) {
      if (trial.metrics) {
        const val = obj.calculate(trial.metrics)
        if (val !== null) scores[obj.id] = val
      }
    }
    return scores
  }

  /** Check if a dominates b */
  private _dominates(
    a: Record<string, number>,
    b: Record<string, number>,
    objectives: ObjectiveDefinition[],
  ): boolean {
    let betterInAny = false
    for (const obj of objectives) {
      const va = a[obj.id]
      const vb = b[obj.id]
      if (va === undefined || vb === undefined) continue

      if (obj.higherIsBetter) {
        if (va < vb) return false
        if (va > vb) betterInAny = true
      } else {
        if (va > vb) return false
        if (va < vb) betterInAny = true
      }
    }
    return betterInAny
  }
}
