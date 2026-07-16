// ── DefaultReport — Standard backtest report template ──
//
// Composes all available sections for a single backtest run.
//
// @since 3.5.5

import type { ReportView } from '../types'
import { ReportRuntime } from '../runtime/ReportRuntime'

export function buildDefaultReport(
  name: string,
  sources: Parameters<ReportRuntime['buildDefaultReport']>[1],
): ReportView {
  const runtime = new ReportRuntime()
  return runtime.buildDefaultReport(name, sources)
}
