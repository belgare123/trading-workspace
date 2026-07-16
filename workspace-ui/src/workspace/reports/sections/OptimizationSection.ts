// ── OptimizationSection — Optimization results ──
//
// @since 3.5.5

import type { OptimizationReportData } from '../../optimization/reports/OptimizationReport'
import type { TrialResult } from '../../optimization/types'
import type { SectionView, LeaderboardRow } from '../types'

export function buildOptimizationSection(
  report: OptimizationReportData,
  trials: TrialResult[],
): SectionView {
  // Leaderboard
  const leaderboard: LeaderboardRow[] = report.leaderboard.map(e => {
    const trial = trials.find(t => t.trialId === e.trialId)
    return {
      rank: e.rank,
      trialId: e.trialId,
      score: e.score,
      tradeCount: trial?.metrics?.tradeCount ?? null,
      profit: trial?.metrics?.keyMetrics['net-profit'] ?? null,
      params: trial?.parameters ?? {},
    }
  })

  // Pareto front (2D: score vs trades)
  const paretoFront = trials
    .filter(t => t.status === 'completed' && t.score !== null && t.metrics)
    .map(t => ({
      x: t.metrics!.tradeCount,
      y: t.score!,
      trialId: t.trialId,
    }))

  // Parameter sensitivity (placeholder — real sensitivity requires analysis)
  const paramSensitivity = report.bestTrial
    ? Object.keys(report.bestTrial.parameters).map((paramId, i) => ({
        paramId,
        importance: 1 / (i + 1), // placeholder: rank-based
      }))
    : []

  return {
    type: 'optimization',
    data: {
      report,
      leaderboard,
      paretoFront,
      heatmap: null, // requires 2D parameter selection
      parameterSensitivity: paramSensitivity,
    },
  }
}
