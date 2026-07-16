// ── ReportSnapshot — Serializable backtest report snapshot ──
//
// @since 3.5.3

import type { BacktestReport } from './BacktestReport'

export interface ReportSnapshotData {
  version: string
  generatedAt: number
  report: {
    sessionId: string
    name: string
    symbol: string
    timeframe: string
    initialCash: number
    duration: {
      elapsedMs: number
      barsProcessed: number
      barsPerSecond: number
    }
    keyMetrics: Record<string, number>
    equity: {
      start: number
      current: number
      peak: number
      maxDrawdown: number
    }
    tradeCount: number
  }
  errors?: string[]
}

export function createReportSnapshot(report: BacktestReport): ReportSnapshotData {
  const eq = report.metrics?.equity
  return {
    version: '3.5.3',
    generatedAt: Date.now(),
    report: {
      sessionId: report.sessionId,
      name: report.name,
      symbol: report.config.symbol,
      timeframe: report.config.timeframe,
      initialCash: report.config.initialCash,
      duration: {
        elapsedMs: report.duration.elapsedMs,
        barsProcessed: report.duration.barsProcessed,
        barsPerSecond: report.duration.barsPerSecond,
      },
      keyMetrics: report.metrics?.keyMetrics ?? {},
      equity: {
        start: eq?.start ?? 0,
        current: eq?.current ?? 0,
        peak: eq?.peak ?? 0,
        maxDrawdown: eq?.maxDrawdown ?? 0,
      },
      tradeCount: report.metrics?.tradeCount ?? 0,
    },
    errors: report.errors,
  }
}
