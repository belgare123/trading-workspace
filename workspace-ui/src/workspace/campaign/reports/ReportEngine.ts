/**
 * ReportEngine.ts — Core snapshot loader + reporter orchestrator
 *
 * Loads metrics from a campaign state directory, filters snapshots
 * by time window, and delegates to domain-specific reporters.
 *
 * Usage:
 *   const engine = new ReportEngine({ dir: '/tmp/paper-campaign/metrics' })
 *   const data = engine.generate()
 *
 * @since M2-02
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { CampaignSnapshotData } from '../CampaignMetricsTypes'
import type { ReportData, ReportFilter, TradingSummary, HealthSummary, RiskSummary, CurvePoint, CampaignDescriptor } from './types'

export class ReportEngine {
  private readonly dir: string

  constructor(config: { dir?: string } = {}) {
    this.dir = config.dir ?? path.join(os.tmpdir(), 'paper-campaign', 'metrics')
  }

  /** Directory for externally discovered state */
  get directory(): string {
    return this.dir
  }

  /**
   * Load all snapshots from the JSONL file.
   * Returns empty array if file doesn't exist or is corrupt.
   */
  loadSnapshots(): CampaignSnapshotData[] {
    const jsonlPath = path.join(this.dir, 'snapshots.jsonl')
    if (!fs.existsSync(jsonlPath)) return []

    const raw = fs.readFileSync(jsonlPath, 'utf-8')
    const lines = raw.split('\n').filter(l => l.trim().length > 0)
    const snapshots: CampaignSnapshotData[] = []

    for (const line of lines) {
      try {
        snapshots.push(JSON.parse(line))
      } catch {
        // Skip corrupt lines
        continue
      }
    }

    return snapshots
  }

  /**
   * Load the latest snapshot from state.json
   */
  loadLatest(): CampaignSnapshotData | null {
    const statePath = path.join(this.dir, 'state.json')
    if (!fs.existsSync(statePath)) return null
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf-8'))
    } catch {
      return null
    }
  }

  /**
   * Group snapshots by campaign ID and detect distinct campaign runs.
   * Returns descriptors sorted by duration (longest first).
   */
  discoverCampaigns(): CampaignDescriptor[] {
    const all = this.loadSnapshots()
    const groups = new Map<string, { timestamps: number[]; trades: number[]; uptimes: number[] }>()

    for (const s of all) {
      const id = s.campaign?.id ?? 'unknown'
      if (!groups.has(id)) groups.set(id, { timestamps: [], trades: [], uptimes: [] })
      const g = groups.get(id)!
      g.timestamps.push(s.timestamp)
      g.trades.push(s.trading.tradesRecorded)
      g.uptimes.push(s.runtime.uptimeSec)
    }

    const descriptors: CampaignDescriptor[] = []
    for (const [id, g] of groups) {
      const minT = Math.min(...g.timestamps)
      const maxT = Math.max(...g.timestamps)
      const maxUptime = Math.max(...g.uptimes)
      descriptors.push({
        id,
        snapshotCount: g.timestamps.length,
        startTime: minT,
        endTime: maxT,
        durationHours: Math.max((maxT - minT) / 3600000, maxUptime / 3600),
        trades: Math.max(...g.trades),
      })
    }

    descriptors.sort((a, b) => b.durationHours - a.durationHours)
    return descriptors
  }

  /**
   * Filter snapshots by time window and/or limit.
   */
  filterSnapshots(snapshots: CampaignSnapshotData[], filter?: ReportFilter): CampaignSnapshotData[] {
    let filtered = [...snapshots]

    if (filter?.campaignId) {
      filtered = filtered.filter(s => s.campaign?.id === filter.campaignId)
    }
    if (filter?.after) {
      filtered = filtered.filter(s => s.timestamp >= filter.after!)
    }
    if (filter?.before) {
      filtered = filtered.filter(s => s.timestamp <= filter.before!)
    }

    // Sort by timestamp ascending
    filtered.sort((a, b) => a.timestamp - b.timestamp)

    if (filter?.last && filter.last < filtered.length) {
      filtered = filtered.slice(-filter.last)
    }

    return filtered
  }

  /**
   * Generate a complete report from loaded snapshots.
   * If `filter.burnIn` is set, automatically selects the longest campaign.
   */
  generate(filter?: ReportFilter): ReportData {
    const allSnapshots = this.loadSnapshots()

    let snapshots: CampaignSnapshotData[]

    if (filter?.burnIn) {
      const campaigns = this.discoverCampaigns()
      const burnIn = campaigns[0]
      if (burnIn) {
        snapshots = this.filterSnapshots(allSnapshots, { campaignId: burnIn.id })
      } else {
        snapshots = this.filterSnapshots(allSnapshots, filter)
      }
    } else {
      snapshots = this.filterSnapshots(allSnapshots, filter)
    }

    const latest = this.loadLatest()

    if (snapshots.length === 0) {
      return {
        campaign: latest?.campaign ?? null,
        trading: null,
        health: null,
        risk: null,
        equityCurve: [],
        timeframe: { start: 0, end: 0, durationHours: 0 },
        snapshotsUsed: 0,
        hasTradeStats: false,
      }
    }

    const first = snapshots[0]
    const last = snapshots[snapshots.length - 1]

    // Determine if M2-01 trade stats are available
    // Find the snapshot with M2-01 data for accurate stats
    const snapshotWithTradeStats = [...snapshots].reverse().find(s =>
      'winningTrades' in s.trading &&
      typeof (s.trading as any).winningTrades === 'number' &&
      (s.trading as any).winningTrades > 0
    )
    const hasTradeStats = snapshotWithTradeStats !== undefined

    // Build equity curve (every snapshot)
    const equityCurve: CurvePoint[] = snapshots.map(s => ({
      t: s.timestamp,
      equity: s.trading.equity,
    }))

    // Compute running peak and drawdown for the curve
    let peak = -Infinity
    let maxDrawdownPct = 0
    let maxDrawdownValue = 0
    let peakEquity = -Infinity
    let troughEquity = Infinity

    for (const pt of equityCurve) {
      if (pt.equity > peak) {
        peak = pt.equity
      }
      pt.peak = peak

      const dd = peak > 0 ? ((peak - pt.equity) / peak) * 100 : 0
      pt.drawdownPct = dd

      if (dd > maxDrawdownPct) {
        maxDrawdownPct = dd
        maxDrawdownValue = peak - pt.equity
      }
      if (pt.equity > peakEquity) peakEquity = pt.equity
      troughEquity = Math.min(troughEquity, pt.equity)
    }

    // Trading summary
    const trading = this.computeTradingSummary(snapshots, hasTradeStats, snapshotWithTradeStats)

    // Health summary
    const health = this.computeHealthSummary(snapshots, last)

    // Risk summary
    const risk: RiskSummary = {
      maxDrawdownPct,
      maxDrawdownValue,
      recoveryFactor: maxDrawdownValue > 0
        ? (trading?.netPnl ?? 0) / maxDrawdownValue
        : 0,
      largestLoss: trading?.largestLoser ?? 0,
      largestWin: trading?.largestWinner ?? 0,
      startEquity: first.trading.equity,
      endEquity: last.trading.equity,
      peakEquity,
      troughEquity,
    }

    const durationHours = (last.timestamp - first.timestamp) / 3600000

    return {
      campaign: last.campaign,
      trading,
      health,
      risk,
      equityCurve,
      timeframe: {
        start: first.timestamp,
        end: last.timestamp,
        durationHours,
      },
      snapshotsUsed: snapshots.length,
      hasTradeStats,
    }
  }

  private computeTradingSummary(
    snapshots: CampaignSnapshotData[],
    hasTradeStats: boolean,
    tradeStatsSnapshot?: CampaignSnapshotData,
  ): TradingSummary | null {
    const last = snapshots[snapshots.length - 1]
    const t = last.trading

    // Prefer the snapshot with actual M2-01 trade stats data
    const source = (hasTradeStats && tradeStatsSnapshot?.trading) || t
    const st = source as any

    return {
      totalTrades: t.tradesRecorded,
      winningTrades: hasTradeStats ? (st.winningTrades ?? 0) : 0,
      losingTrades: hasTradeStats ? (st.losingTrades ?? 0) : 0,
      winRate: hasTradeStats ? (st.winRate ?? 0) : 0,
      profitFactor: hasTradeStats ? (st.profitFactor ?? 0) : 0,
      grossProfit: hasTradeStats ? (st.totalGrossProfit ?? 0) : 0,
      grossLoss: hasTradeStats ? (st.totalGrossLoss ?? 0) : 0,
      netPnl: t.realisedPnl,
      totalFees: t.totalFees,
      expectancy: hasTradeStats ? (st.expectancy ?? 0) : 0,
      averageWin: hasTradeStats ? (st.averageWin ?? 0) : 0,
      averageLoss: hasTradeStats ? (st.averageLoss ?? 0) : 0,
      maxWinStreak: hasTradeStats ? (st.maxWinStreak ?? 0) : 0,
      maxLossStreak: hasTradeStats ? (st.maxLossStreak ?? 0) : 0,
      largestWinner: t.largestWinner,
      largestLoser: t.largestLoser,
    }
  }

  private computeHealthSummary(
    snapshots: CampaignSnapshotData[],
    last: CampaignSnapshotData,
  ): HealthSummary {
    const rssValues = snapshots.map(s => s.runtime.rssMB)
    const cpuValues = snapshots.map(s => s.runtime.cpuPercent)

    const totalReconnects = snapshots.reduce((sum, s) => {
      const feed = s.health.feed.reconnects
      const broker = s.health.broker.reconnects
      return sum + feed + broker
    }, 0)

    const totalExceptions = 0 // not tracked per-snapshot yet

    const validSnapshots = snapshots.filter(s =>
      s.trading.equity > 0 &&
      Number.isFinite(s.trading.equity) &&
      s.runtime.rssMB > 0
    )

    const avgRss = rssValues.reduce((a, b) => a + b, 0) / rssValues.length

    return {
      rssMin: Math.min(...rssValues),
      rssMax: Math.max(...rssValues),
      rssAvg: Math.round(avgRss * 10) / 10,
      cpuMin: Math.min(...cpuValues),
      cpuMax: Math.max(...cpuValues),
      cpuAvg: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
      totalReconnects,
      totalExceptions,
      snapshotCount: snapshots.length,
      validSnapshotCount: validSnapshots.length,
      gcCount: last.runtime.gcCount,
      gcPauseMaxMs: last.runtime.gcPauseMaxMs,
      eventLoopAvg: snapshots
        .map(s => s.runtime.eventLoopUtilization)
        .reduce((a, b) => a + b, 0) / snapshots.length,
      uptimeSec: last.runtime.uptimeSec,
    }
  }
}
