// ── Leaderboard — Top-N leaderboard table ──
//
// @since 3.5.4

import type { TrialResult, ObjectiveDefinition } from '../types'
import { RankingEngine } from './RankingEngine'

export interface LeaderboardEntry {
  rank: number
  trialId: string
  parameters: Record<string, unknown>
  score: number | null
  tradeCount: number
  duration: number
  error?: string
}

export class Leaderboard {
  private _ranking: RankingEngine = new RankingEngine()

  /** Build a full leaderboard from completed trials */
  build(
    trials: TrialResult[],
    objective: ObjectiveDefinition,
  ): LeaderboardEntry[] {
    const ranked = this._ranking.rank(trials, objective)

    return ranked.map((r, i) => {
      const trial = trials.find(t => t.trialId === r.trialId)
      return {
        rank: i + 1,
        trialId: r.trialId,
        parameters: r.parameters,
        score: r.score,
        tradeCount: trial?.metrics?.tradeCount ?? 0,
        duration: trial?.duration ?? 0,
        error: trial?.error,
      }
    })
  }

  /** Get top-N leaderboard */
  top(trials: TrialResult[], objective: ObjectiveDefinition, n: number): LeaderboardEntry[] {
    return this.build(trials, objective).slice(0, n)
  }

  /** Render leaderboard as formatted text */
  formatTable(entries: LeaderboardEntry[]): string {
    const lines: string[] = []
    lines.push('┌──────┬──────────────────────────┬──────────┬──────────┬──────────┐')
    lines.push('│ Rank │ Trial ID                 │ Score    │ Trades   │ Duration │')
    lines.push('├──────┼──────────────────────────┼──────────┼──────────┼──────────┤')

    for (const e of entries) {
      const rank = String(e.rank).padEnd(4)
      const id = e.trialId.slice(-20).padEnd(24)
      const score = e.score !== null ? e.score.toFixed(4).padEnd(8) : 'null    '
      const trades = String(e.tradeCount).padEnd(8)
      const dur = `${(e.duration / 1000).toFixed(1)}s`.padEnd(8)
      lines.push(`│ ${rank} │ ${id} │ ${score} │ ${trades} │ ${dur} │`)
    }

    lines.push('└──────┴──────────────────────────┴──────────┴──────────┴──────────┘')
    return lines.join('\n')
  }
}
