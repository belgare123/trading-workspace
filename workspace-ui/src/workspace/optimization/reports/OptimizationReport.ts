// ── OptimizationReport — Final optimization campaign report ──
//
// @since 3.5.4

import type { OptimizationConfig, TrialResult, ObjectiveDefinition } from '../types'
import type { OptimizationSessionInfo } from '../types'

export interface OptimizationReportData {
  session: OptimizationSessionInfo
  config: OptimizationConfig
  duration: number
  bestTrial: TrialResult | null
  worstTrial: TrialResult | null
  trialCount: number
  completedCount: number
  failedCount: number
  leaderboard: { rank: number; trialId: string; score: number | null }[]
}

export class OptimizationReportBuilder {
  build(
    session: OptimizationSessionInfo,
    config: OptimizationConfig,
    trials: TrialResult[],
    objective: ObjectiveDefinition,
    startedAt: number,
  ): OptimizationReportData {
    const completed = trials.filter(t => t.status === 'completed' && t.score !== null)
    const failed = trials.filter(t => t.status === 'failed')

    const sorted = objective.higherIsBetter
      ? [...completed].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
      : [...completed].sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity))

    return {
      session,
      config,
      duration: Date.now() - startedAt,
      bestTrial: sorted[0] ?? null,
      worstTrial: sorted[sorted.length - 1] ?? null,
      trialCount: trials.length,
      completedCount: completed.length,
      failedCount: failed.length,
      leaderboard: sorted.slice(0, 10).map((t, i) => ({
        rank: i + 1,
        trialId: t.trialId,
        score: t.score,
      })),
    }
  }

  format(report: OptimizationReportData): string {
    const lines: string[] = [
      '═══════════════════════════════════════',
      '  Optimization Report',
      '═══════════════════════════════════════',
      '',
      `Session:  ${report.session.name} (${report.session.id})`,
      `Config:   ${report.config.name}`,
      `Duration: ${(report.duration / 1000).toFixed(1)}s`,
      `Status:   ${report.session.status}`,
      '',
      `Trials:   ${report.trialCount} total, ${report.completedCount} completed, ${report.failedCount} failed`,
      '',
    ]

    if (report.bestTrial) {
      lines.push('── Best Trial ──')
      lines.push(`  ID:      ${report.bestTrial.trialId}`)
      lines.push(`  Score:   ${report.bestTrial.score?.toFixed(4) ?? 'N/A'}`)
      lines.push(`  Params:  ${JSON.stringify(report.bestTrial.parameters)}`)
      if (report.bestTrial.metrics) {
        lines.push(`  Trades:  ${report.bestTrial.metrics.tradeCount}`)
        lines.push(`  Equity:  $${report.bestTrial.metrics.equity.current.toFixed(2)}`)
      }
      lines.push('')
    }

    if (report.leaderboard.length > 0) {
      lines.push('── Leaderboard (Top 10) ──')
      lines.push('  Rank │ Trial ID                          │ Score')
      lines.push('  ─────┼───────────────────────────────────┼──────────')
      for (const e of report.leaderboard) {
        const id = e.trialId.padEnd(34).slice(0, 34)
        const score = e.score !== null ? e.score.toFixed(4).padStart(10) : '    N/A   '
        lines.push(`  ${String(e.rank).padEnd(4)} │ ${id} │ ${score}`)
      }
    }

    return lines.join('\n')
  }
}
