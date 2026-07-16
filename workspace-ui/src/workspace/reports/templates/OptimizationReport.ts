// ── OptimizationReport — Optimization campaign report template ──
//
// @since 3.5.5

import type { OptimizationReportData } from '../../optimization/reports/OptimizationReport'
import type { TrialResult } from '../../optimization/types'
import type { ReportView } from '../types'
import { ReportRuntime } from '../runtime/ReportRuntime'

export function buildOptimizationReportTemplate(
  name: string,
  optReport: OptimizationReportData,
  trials: TrialResult[],
  curves?: { id: string; name: string; points: { timestamp: number; value: number }[] }[],
): ReportView {
  const runtime = new ReportRuntime()
  return runtime.buildOptimizationReport(name, optReport, trials, curves)
}
