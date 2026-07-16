// ── Report Runtime — Orchestrator ──
//
// Composes ReportView from available snapshots.
// Pure view builder — no computation.
//
// @since 3.5.5

import type { OptimizationReportData } from '../../optimization/reports/OptimizationReport'
import type { TrialResult } from '../../optimization/types'
import type { ReportView, SectionView, ReportSources } from '../types'

import { buildSummarySection } from '../sections/SummarySection'
import { buildPerformanceSection } from '../sections/PerformanceSection'
import { buildRiskSection } from '../sections/RiskSection'
import { buildTradesSection } from '../sections/TradesSection'
import { buildOptimizationSection } from '../sections/OptimizationSection'
import { buildParametersSection } from '../sections/ParametersSection'

export class ReportRuntime {
  buildDefaultReport(
    name: string,
    sources: ReportSources,
  ): ReportView {
    const sections: SectionView[] = []

    // 1. Executive Summary (always from metrics)
    const metricsSnap = sources.metricsSnapshot
    if (metricsSnap) {
      sections.push(buildSummarySection(metricsSnap, sources.trades?.records.length))
    }

    // 2. Performance / Equity (curves from metrics)
    if (sources.metrics?.curves) {
      sections.push(buildPerformanceSection(sources.metrics.curves))
    }

    // 3. Risk
    if (sources.metrics?.metrics) {
      sections.push(buildRiskSection(sources.metrics.metrics))
    }

    // 4. Trades
    if (sources.trades?.records) {
      sections.push(buildTradesSection(sources.trades.records))
    }

    // 5. Parameters
    if (sources.backtestReport?.config) {
      sections.push(buildParametersSection(sources.backtestReport.config.strategyParams ?? {}))
    }

    return {
      id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      type: 'default',
      sections,
      sources: {
        backtestReport: sources.backtestReport ?? null,
        metricsSnapshot: metricsSnap ?? null,
        optimizationReport: sources.optimizationReport ?? null,
      },
      generatedAt: Date.now(),
    }
  }

  buildOptimizationReport(
    name: string,
    optReport: OptimizationReportData,
    trials: TrialResult[],
    curves?: { id: string; name: string; points: { timestamp: number; value: number }[] }[],
  ): ReportView {
    const sections: SectionView[] = []

    // 1. Summary (from best trial)
    if (optReport.bestTrial?.metrics) {
      sections.push(buildSummarySection(optReport.bestTrial.metrics))
    }

    // 2. Performance (curves if available)
    if (curves) {
      sections.push(buildPerformanceSection(curves))
    }

    // 3. Optimization section
    sections.push(buildOptimizationSection(optReport, trials))

    // 4. Parameters of best trial
    if (optReport.bestTrial?.parameters) {
      sections.push(buildParametersSection(optReport.bestTrial.parameters as Record<string, unknown>))
    }

    return {
      id: `opt_report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      type: 'optimization',
      sections,
      sources: {
        backtestReport: null,
        metricsSnapshot: optReport.bestTrial?.metrics ?? null,
        optimizationReport: optReport,
      },
      generatedAt: Date.now(),
    }
  }

  getSection<T extends SectionView>(report: ReportView, type: T['type']): T | undefined {
    return report.sections.find(s => s.type === type) as T | undefined
  }
}
