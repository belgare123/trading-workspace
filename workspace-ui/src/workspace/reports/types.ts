// ── Report Types — shared contracts for Report Runtime ──
//
// Pure presentation types. No computation logic.
// Reads from MetricsSnapshot, BacktestReport, OptimizationReportData.
//
// @since 3.5.5

import type { MetricsSnapshot } from '../metrics/serialization/MetricsSnapshot'
import type { BacktestReport } from '../backtest/report/BacktestReport'
import type { OptimizationReportData } from '../optimization/reports/OptimizationReport'
import type { TrialResult } from '../optimization/types'

// ═══════════════════════════════════════
// Time-series data for charts
// ═══════════════════════════════════════

export interface ChartPoint {
  timestamp: number
  value: number
  label?: string
}

export interface ChartData {
  id: string
  name: string
  points: ChartPoint[]
}

export interface BarChartData {
  id: string
  name: string
  bars: { label: string; value: number; color?: string }[]
}

export interface HistogramData {
  id: string
  name: string
  bins: { rangeMin: number; rangeMax: number; count: number }[]
}

export interface ScatterData {
  id: string
  name: string
  points: { x: number; y: number; label?: string; size?: number }[]
}

export interface HeatmapData {
  id: string
  name: string
  xLabels: string[]
  yLabels: string[]
  values: number[][]
}

// ═══════════════════════════════════════
// Section View models
// ═══════════════════════════════════════

export interface SummaryMetrics {
  netProfit: number | null
  cagr: number | null
  sharpe: number | null
  sortino: number | null
  maxDrawdown: number | null
  profitFactor: number | null
  winRate: number | null
  expectancy: number | null
  totalTrades: number
}

export interface EquityAnalysisData {
  equityCurve: ChartPoint[]
  balanceCurve: ChartPoint[]
  drawdownCurve: ChartPoint[]
  exposureCurve: ChartPoint[]
}

export interface RiskMetrics {
  recoveryFactor: number | null
  calmarRatio: number | null
  ulcerIndex: number | null
  kellyCriterion: number | null
  sqn: number | null
}

export interface TradeAnalyticsData {
  profitDistribution: HistogramData[]
  dayOfWeekProfit: BarChartData
  hourOfDayProfit: BarChartData
  winLossStreak: { longestWin: number; longestLoss: number }
  tradeList: TradeRow[]
}

export interface TradeRow {
  index: number
  timestamp: number
  symbol: string
  direction: 'long' | 'short'
  entryPrice: number
  exitPrice: number
  quantity: number
  pnl: number
  pnlPercent: number
  barsHeld: number
}

// ═══════════════════════════════════════
// Optimization View
// ═══════════════════════════════════════

export interface OptimizationViewData {
  report: OptimizationReportData
  leaderboard: LeaderboardRow[]
  paretoFront: { x: number; y: number; trialId: string }[]
  heatmap: HeatmapData | null
  parameterSensitivity: { paramId: string; importance: number }[]
}

export interface LeaderboardRow {
  rank: number
  trialId: string
  score: number | null
  tradeCount: number | null
  profit: number | null
  params: Record<string, unknown>
}

// ═══════════════════════════════════════
// Report Sources (input to ReportRuntime)
// ═══════════════════════════════════════

export interface ReportSources {
  backtestReport?: BacktestReport | null
  metricsSnapshot?: MetricsSnapshot | null
  metrics?: {
    metrics: { id: string; name: string; value: number; formatted: string; category: string }[]
    curves: { id: string; name: string; points: { timestamp: number; value: number }[] }[]
  }
  trades?: {
    records: {
      timestamp: number
      symbol: string
      direction: 'long' | 'short'
      entryPrice: number
      exitPrice: number
      quantity: number
      pnl: number
      pnlPercent: number
      barsHeld: number
    }[]
  }
  optimizationReport?: OptimizationReportData | null
  trials?: TrialResult[]
  curves?: { id: string; name: string; points: { timestamp: number; value: number }[] }[]
}

// ═══════════════════════════════════════
// Section View (union)
// ═══════════════════════════════════════

export type SectionView =
  | { type: 'summary'; data: SummaryMetrics }
  | { type: 'equity'; data: EquityAnalysisData }
  | { type: 'risk'; data: RiskMetrics }
  | { type: 'trades'; data: TradeAnalyticsData }
  | { type: 'optimization'; data: OptimizationViewData }
  | { type: 'parameters'; data: Record<string, unknown> }

// ═══════════════════════════════════════
// Full Report View
// ═══════════════════════════════════════

export interface ReportView {
  id: string
  name: string
  type: 'default' | 'optimization' | 'walkforward'
  sections: SectionView[]
  sources: {
    backtestReport: BacktestReport | null
    metricsSnapshot: MetricsSnapshot | null
    optimizationReport: OptimizationReportData | null
  }
  generatedAt: number
}
