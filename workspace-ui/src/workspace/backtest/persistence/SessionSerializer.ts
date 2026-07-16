// ── SessionSerializer — Save/load backtest sessions and results ──
//
// @since 3.5.3

import type { BacktestSessionInfo } from '../types'
import type { BacktestReport } from '../report/BacktestReport'
import { createReportSnapshot } from '../report/ReportSnapshot'
import type { ReportSnapshotData } from '../report/ReportSnapshot'

export class SessionSerializer {
  /** Serialize session info to JSON */
  serializeSession(session: BacktestSessionInfo): string {
    return JSON.stringify(session, null, 2)
  }

  /** Deserialize session info from JSON */
  deserializeSession(json: string): BacktestSessionInfo {
    return JSON.parse(json) as BacktestSessionInfo
  }

  /** Serialize backtest report to JSON */
  serializeReport(report: BacktestReport): string {
    const snapshot = createReportSnapshot(report)
    return JSON.stringify(snapshot, null, 2)
  }

  /** Deserialize report snapshot from JSON */
  deserializeReport(json: string): ReportSnapshotData {
    return JSON.parse(json) as ReportSnapshotData
  }

  /** Serialize multiple reports to JSON array */
  serializeReports(reports: BacktestReport[]): string {
    return JSON.stringify(reports.map(r => createReportSnapshot(r)), null, 2)
  }

  /** Export to single-line JSON (compact storage) */
  serializeCompact(reports: BacktestReport[]): string {
    return JSON.stringify(reports.map(r => ({
      id: r.sessionId,
      name: r.name,
      symbol: r.config.symbol,
      tf: r.config.timeframe,
      return: r.metrics?.keyMetrics['profit-factor'] ?? 0,
      trades: r.metrics?.tradeCount ?? 0,
      dd: r.metrics?.equity.maxDrawdown ?? 0,
    })))
  }
}
