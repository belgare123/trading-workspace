// ── WalkForwardReport — Walk-forward report template ──
//
// Combines per-window backtest reports + optimization results.
//
// @since 3.5.5

import type { ReportView, SectionView } from '../types'
import type { BacktestReport } from '../../backtest/report/BacktestReport'
import type { OptimizationReportData } from '../../optimization/reports/OptimizationReport'
import type { TrialResult } from '../../optimization/types'
import { ReportRuntime } from '../runtime/ReportRuntime'

export interface WalkForwardWindowResult {
  windowIndex: number
  isStart: number
  oosStart: number
  oosEnd: number
  isConfig: Record<string, unknown>
  backtestReport: BacktestReport
}

export function buildWalkForwardReport(
  name: string,
  windows: WalkForwardWindowResult[],
  optReport: OptimizationReportData,
  trials: TrialResult[],
): ReportView {
  const runtime = new ReportRuntime()
  const base = runtime.buildOptimizationReport(
    `${name} (Walk-Forward)`,
    optReport,
    trials,
  )

  // Add per-window summary as additional sections
  const summarySections: SectionView[] = windows.map((w, i) => ({
    type: 'parameters' as const,
    data: {
      'Window Index': i + 1,
      'IS Start': new Date(w.isStart).toISOString().slice(0, 10),
      'OOS Start': new Date(w.oosStart).toISOString().slice(0, 10),
      'OOS End': new Date(w.oosEnd).toISOString().slice(0, 10),
      ...Object.fromEntries(
        Object.entries(w.isConfig).map(([k, v]) => [`IS ${k}`, v]),
      ),
    },
  }))

  return {
    ...base,
    type: 'walkforward',
    sections: [...base.sections, ...summarySections],
  }
}
