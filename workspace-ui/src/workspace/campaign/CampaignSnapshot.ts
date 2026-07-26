/**
 * CampaignSnapshot.ts — Factory for canonical campaign snapshots
 *
 * CampaignSnapshot.create() takes raw metrics from the Provider and
 * returns a fully normalised, validated, self-describing snapshot
 * ready for serialisation.
 *
 * Responsibilities:
 *  - Inject schemaVersion and timestamp
 *  - Round/format all numeric values
 *  - Sort arrays (positions, orders) for stable output
 *  - Validate required fields
 *  - Freeze the result (immutable by convention)
 *
 * @since 4.9
 */

import type { CampaignContext } from './CampaignContext'
import type { CampaignSnapshotData, RawMetrics, TradingSnapshot, RuntimeSnapshot, HealthSnapshot, InvariantSnapshot, InvariantResult } from './CampaignMetricsTypes'
import { SNAPSHOT_SCHEMA_VERSION } from './CampaignMetricsTypes'

export class CampaignSnapshot {
  /**
   * Create a canonical snapshot from raw provider metrics.
   *
   * @param ctx  - Campaign identity injected into every snapshot
   * @param raw  - Raw metrics from the provider
   * @returns    - A fully normalised snapshot ready for writing
   */
  static create(ctx: CampaignContext, raw: RawMetrics): CampaignSnapshotData {
    const snapshot: CampaignSnapshotData = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      timestamp: Date.now(),
      campaign: ctx,
      trading: this.normaliseTrading(raw.trading),
      runtime: this.normaliseRuntime(raw.runtime),
      health: this.normaliseHealth(raw.health),
      invariants: this.normaliseInvariants(raw.invariants),
    }

    // Run validation (throws on critical issues)
    this.validate(snapshot)

    return Object.freeze(snapshot) as CampaignSnapshotData
  }

  // ── Private normalisers ──

  private static normaliseTrading(t: TradingSnapshot): TradingSnapshot {
    return {
      freeBalance: round2(t.freeBalance),
      equity: round2(t.equity),
      realisedPnl: round2(t.realisedPnl),
      unrealisedPnl: round2(t.unrealisedPnl),
      totalFees: round2(t.totalFees),
      tradesRecorded: Math.round(t.tradesRecorded),
      openPositions: Math.round(t.openPositions),
      activeOrders: Math.round(t.activeOrders),
      exposurePct: round2(t.exposurePct),
      leverage: round2(t.leverage),
      largestPositionSize: round2(t.largestPositionSize),
      largestWinner: round2(t.largestWinner),
      largestLoser: round2(t.largestLoser),
      averageHoldTimeSec: round0(t.averageHoldTimeSec),
      averageCommission: round4(t.averageCommission),
      averageSlippage: round4(t.averageSlippage),
      // Trade Stats (M2-01)
      winningTrades: Math.round(t.winningTrades),
      losingTrades: Math.round(t.losingTrades),
      winRate: round4(t.winRate),
      profitFactor: round2(t.profitFactor),
      totalGrossProfit: round2(t.totalGrossProfit),
      totalGrossLoss: round2(t.totalGrossLoss),
      averageWin: round2(t.averageWin),
      averageLoss: round2(t.averageLoss),
      expectancy: round2(t.expectancy),
      maxWinStreak: Math.round(t.maxWinStreak),
      maxLossStreak: Math.round(t.maxLossStreak),
    }
  }

  private static normaliseRuntime(r: RuntimeSnapshot): RuntimeSnapshot {
    return {
      nodeVersion: r.nodeVersion,
      pid: Math.round(r.pid),
      uptimeSec: round0(r.uptimeSec),
      rssMB: round1(r.rssMB),
      heapUsedMB: round1(r.heapUsedMB),
      heapTotalMB: round1(r.heapTotalMB),
      cpuPercent: round2(r.cpuPercent),
      eventLoopUtilization: round4(r.eventLoopUtilization),
      gcCount: Math.round(r.gcCount),
      gcPauseMaxMs: round1(r.gcPauseMaxMs),
    }
  }

  private static normaliseHealth(h: HealthSnapshot): HealthSnapshot {
    return {
      feed: this.normaliseComponent(h.feed),
      broker: this.normaliseComponent(h.broker),
      strategy: this.normaliseComponent(h.strategy),
      certification: this.normaliseComponent(h.certification),
      storage: this.normaliseComponent(h.storage),
    }
  }

  private static normaliseComponent(c: { status: string; lastMessageAgeMs: number; reconnects: number; latencyMs: number; message?: string }) {
    return {
      status: c.status as 'healthy' | 'degraded' | 'down' | 'unknown',
      lastMessageAgeMs: round0(c.lastMessageAgeMs),
      reconnects: Math.round(c.reconnects),
      latencyMs: round0(c.latencyMs),
      ...(c.message !== undefined ? { message: c.message } : {}),
    }
  }

  private static normaliseInvariants(i: InvariantSnapshot): InvariantSnapshot {
    return {
      positionSync: this.normaliseInvariant(i.positionSync),
      balanceSync: this.normaliseInvariant(i.balanceSync),
      ordersSync: this.normaliseInvariant(i.ordersSync),
      tradeJournalConsistency: this.normaliseInvariant(i.tradeJournalConsistency),
      eventStoreIntegrity: this.normaliseInvariant(i.eventStoreIntegrity),
    }
  }

  private static normaliseInvariant(inv: InvariantResult): InvariantResult {
    return {
      ok: inv.ok,
      ...(inv.reason !== undefined ? { reason: inv.reason } : {}),
      ...(inv.delta !== undefined ? { delta: round4(inv.delta) } : {}),
    }
  }

  // ── Validation ──

  /**
   * Lightweight validation that catches structural issues early.
   * Throws on problems that would produce broken output.
   */
  private static validate(snapshot: CampaignSnapshotData): void {
    if (!snapshot.campaign.id) {
      throw new Error('[CampaignSnapshot] Missing campaign.id')
    }
    if (!snapshot.campaign.exchange) {
      throw new Error('[CampaignSnapshot] Missing campaign.exchange')
    }
    if (typeof snapshot.trading.equity !== 'number' || !isFinite(snapshot.trading.equity)) {
      throw new Error(`[CampaignSnapshot] Invalid equity: ${snapshot.trading.equity}`)
    }
    if (snapshot.trading.tradesRecorded < 0) {
      throw new Error(`[CampaignSnapshot] Negative tradesRecorded: ${snapshot.trading.tradesRecorded}`)
    }
  }
}

// ── Helpers ──

function round0(v: number): number {
  return Math.round(v)
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000
}
