/**
 * types.ts — Report Engine shared types
 *
 * @since M2-02
 */

import type { CampaignSnapshotData } from '../CampaignMetricsTypes'

/** Filter criteria for selecting snapshots */
export interface ReportFilter {
  /** Only snapshots after this timestamp (Unix ms) */
  after?: number
  /** Only snapshots before this timestamp (Unix ms) */
  before?: number
  /** Max snapshots to include (newest N) */
  last?: number
  /** Only snapshots matching this campaign ID */
  campaignId?: string
  /** Auto-select the longest-running campaign (burn-in) */
  burnIn?: boolean
}

/** One point on an equity/drawdown curve */
export interface CurvePoint {
  /** Snapshot timestamp (Unix ms) */
  t: number
  /** Equity value */
  equity: number
  /** Running maximum equity up to this point (for drawdown calc) */
  peak?: number
  /** Drawdown % from peak at this point */
  drawdownPct?: number
}

/** Summary of trading performance */
export interface TradingSummary {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  profitFactor: number
  /** Gross PnL from price spreads (before fees) — derived from realisedPnl / TradeLedger */
  grossPnL: number
  grossProfit: number
  grossLoss: number
  /** Net PnL after fees: grossPnL - totalFees */
  netPnl: number
  totalFees: number
  expectancy: number
  averageWin: number
  averageLoss: number
  maxWinStreak: number
  maxLossStreak: number
  largestWinner: number
  largestLoser: number
}

/** Summary of system health across snapshots */
export interface HealthSummary {
  rssMin: number
  rssMax: number
  rssAvg: number
  cpuMin: number
  cpuMax: number
  cpuAvg: number
  totalReconnects: number
  totalExceptions: number
  snapshotCount: number
  validSnapshotCount: number
  gcCount: number
  gcPauseMaxMs: number
  eventLoopAvg: number
  uptimeSec: number
}

/** Risk metrics */
export interface RiskSummary {
  maxDrawdownPct: number
  maxDrawdownValue: number
  recoveryFactor: number
  largestLoss: number
  largestWin: number
  startEquity: number
  endEquity: number
  peakEquity: number
  troughEquity: number
}

/** Complete report data */
export interface ReportData {
  campaign: CampaignSnapshotData['campaign'] | null
  trading: TradingSummary | null
  health: HealthSummary | null
  risk: RiskSummary | null
  equityCurve: CurvePoint[]
  timeframe: { start: number; end: number; durationHours: number }
  snapshotsUsed: number
  hasTradeStats: boolean  // whether source data had M2-01 fields
}

/** Describes a discovered campaign run in the snapshot history */
export interface CampaignDescriptor {
  id: string
  snapshotCount: number
  startTime: number
  endTime: number
  durationHours: number
  trades: number
} 
