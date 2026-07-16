// ── ReportBuilder — Builds backtest report from metrics snapshot ──
//
// Separates computation (MetricsRuntime) from presentation (Report).
//
// @since 3.5.3

import type { BacktestReport } from '../types'
import type { ReportSnapshotData } from './ReportSnapshot'
import { createReportSnapshot } from './ReportSnapshot'

export class ReportBuilder {
  /** Build a snapshot data from a report */
  build(report: BacktestReport): ReportSnapshotData {
    return createReportSnapshot(report)
  }

  /** Build and format as human-readable string */
  buildText(report: BacktestReport): string {
    const data = this.build(report)
    const r = data.report
    const lines = [
      `═ ${r.name} ═`,
      `Symbol: ${r.symbol} · Timeframe: ${r.timeframe}`,
      `Initial Cash: $${r.initialCash.toLocaleString()}`,
      `Bars: ${r.duration.barsProcessed} · Elapsed: ${(r.duration.elapsedMs / 1000).toFixed(1)}s · Bars/s: ${r.duration.barsPerSecond.toFixed(1)}`,
      '',
      '─ Equity ─',
      `  Start:  $${r.equity.start.toLocaleString()}`,
      `  End:    $${r.equity.current.toLocaleString()}`,
      `  Peak:   $${r.equity.peak.toLocaleString()}`,
      `  Max DD: ${(r.equity.maxDrawdown * 100).toFixed(2)}%`,
      '',
      '─ Metrics ─',
    ]

    for (const [key, value] of Object.entries(r.keyMetrics)) {
      lines.push(`  ${key}: ${typeof value === 'number' ? value.toFixed(4) : value}`)
    }

    if (r.tradeCount > 0) {
      lines.push(`  Trades: ${r.tradeCount}`)
    }

    if (data.errors?.length) {
      lines.push('', '! Errors:', ...data.errors.map(e => `  - ${e}`))
    }

    return lines.join('\n')
  }

  /** Build summary (one line) */
  buildSummary(report: BacktestReport): string {
    const r = report.metrics
    if (!r) return `[${report.sessionId}] No metrics`

    const returnPct = r.equity.start > 0
      ? ((r.equity.current - r.equity.start) / r.equity.start * 100).toFixed(2)
      : 'N/A'
    const ddPct = (r.equity.maxDrawdown * 100).toFixed(2)

    return `[${report.name}] Return: ${returnPct}% · MaxDD: ${ddPct}% · Trades: ${r.tradeCount} · Bars: ${report.duration.barsProcessed}`
  }
}
