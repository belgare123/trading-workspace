// ── RankingEngine — Rank trials by objective score ──
//
// @since 3.5.4

import type { TrialResult, RankEntry, ObjectiveDefinition } from '../types'

export class RankingEngine {
  /** Rank all completed trials by objective */
  rank(trials: TrialResult[], objective: ObjectiveDefinition): RankEntry[] {
    const scored = trials
      .filter(t => t.status === 'completed' && t.score !== null)
      .map(t => ({
        ...t,
        score: t.score!,
      }))

    const sorted = objective.higherIsBetter
      ? scored.sort((a, b) => b.score - a.score)
      : scored.sort((a, b) => a.score - b.score)

    return sorted.map((t, i) => ({
      rank: i + 1,
      trialId: t.trialId,
      parameters: t.parameters,
      score: t.score,
      higherIsBetter: objective.higherIsBetter,
    }))
  }

  /** Get the top-N trials */
  topN(trials: TrialResult[], objective: ObjectiveDefinition, n: number): RankEntry[] {
    return this.rank(trials, objective).slice(0, n)
  }

  /** Score a single trial against an objective */
  score(trial: TrialResult, objective: ObjectiveDefinition): number | null {
    if (!trial.metrics) return null
    return objective.calculate(trial.metrics)
  }
}
