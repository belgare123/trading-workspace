// ── TrialSummary — Single trial result summary ──
//
// @since 3.5.4

import type { TrialResult, ObjectiveDefinition } from '../types'
import { RankingEngine } from '../ranking/RankingEngine'

export interface TrialSummary {
  trialId: string
  status: string
  parameters: Record<string, unknown>
  score: number | null
  duration: number
  tradeCount: number
  equityStart: number
  equityEnd: number
  maxDrawdown: number
  keyMetrics: Record<string, number>
}

export class TrialSummaryBuilder {
  build(trial: TrialResult, objective?: ObjectiveDefinition): TrialSummary {
    const score = objective
      ? new RankingEngine().score(trial, objective)
      : trial.score

    return {
      trialId: trial.trialId,
      status: trial.status,
      parameters: trial.parameters,
      score,
      duration: trial.duration,
      tradeCount: trial.metrics?.tradeCount ?? 0,
      equityStart: trial.metrics?.equity.start ?? 0,
      equityEnd: trial.metrics?.equity.current ?? 0,
      maxDrawdown: trial.metrics?.equity.maxDrawdown ?? 0,
      keyMetrics: trial.metrics?.keyMetrics ?? {},
    }
  }

  format(summary: TrialSummary): string {
    const lines: string[] = [
      `Trial:   ${summary.trialId}`,
      `Status:  ${summary.status}`,
      `Score:   ${summary.score !== null ? summary.score.toFixed(4) : 'null'}`,
      `Trades:  ${summary.tradeCount}`,
      `Equity:  $${summary.equityStart.toFixed(2)} → $${summary.equityEnd.toFixed(2)}`,
      `Max DD:  ${(summary.maxDrawdown * 100).toFixed(2)}%`,
      `Time:    ${(summary.duration / 1000).toFixed(1)}s`,
      `Params:  ${JSON.stringify(summary.parameters)}`,
    ]

    if (Object.keys(summary.keyMetrics).length > 0) {
      lines.push('Metrics:')
      for (const [k, v] of Object.entries(summary.keyMetrics)) {
        lines.push(`  ${k}: ${v.toFixed(4)}`)
      }
    }

    return lines.join('\n')
  }
}
