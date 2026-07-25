/**
 * types.ts — Campaign snapshot type definitions
 *
 * These types define the canonical shape of every metric snapshot
 * collected during a campaign. The structure is versioned via
 * schemaVersion so that future readers can migrate old snapshots.
 *
 * @since 4.9
 */

import type { CampaignContext } from './CampaignContext'

// ── Schema ──

/** Current snapshot schema version. Bump on breaking changes. */
export const SNAPSHOT_SCHEMA_VERSION = 1

// ── Trading Metrics ──

export interface TradingSnapshot {
  /** Free balance in quote currency */
  freeBalance: number
  /** Total equity (balance + unrealised PnL) */
  equity: number
  /** Realised PnL for the campaign */
  realisedPnl: number
  /** Unrealised PnL from open positions */
  unrealisedPnl: number
  /** Total fees paid */
  totalFees: number
  /** Total number of trades recorded */
  tradesRecorded: number
  /** Number of open positions */
  openPositions: number
  /** Number of active orders */
  activeOrders: number
  /** Exposure as % of equity (sum of position notional / equity) */
  exposurePct: number
  /** Current leverage */
  leverage: number
  /** Largest single position size */
  largestPositionSize: number
  /** Best single trade PnL */
  largestWinner: number
  /** Worst single trade PnL */
  largestLoser: number
  /** Average hold time in seconds */
  averageHoldTimeSec: number
  /** Average commission per trade */
  averageCommission: number
  /** Average slippage per trade in quote currency */
  averageSlippage: number
}

// ── Runtime Metrics ──

export interface RuntimeSnapshot {
  /** Node.js version */
  nodeVersion: string
  /** Process PID */
  pid: number
  /** Process uptime in seconds */
  uptimeSec: number
  /** Memory usage RSS in MB */
  rssMB: number
  /** Heap used in MB */
  heapUsedMB: number
  /** Heap total in MB */
  heapTotalMB: number
  /** CPU usage % (process) */
  cpuPercent: number
  /** Event loop utilization (0–1), NaN if unavailable */
  eventLoopUtilization: number
  /** Cumulative GC count since start */
  gcCount: number
  /** Longest GC pause in ms */
  gcPauseMaxMs: number
}

// ── Health Metrics ──

export interface ComponentHealth {
  /** Human-readable status */
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  /** Ms since last message from this component */
  lastMessageAgeMs: number
  /** Total reconnect events */
  reconnects: number
  /** Last known latency in ms */
  latencyMs: number
  /** Optional explanatory message */
  message?: string
}

export interface HealthSnapshot {
  /** Feed connection health */
  feed: ComponentHealth
  /** Broker/execution health */
  broker: ComponentHealth
  /** Strategy runtime health */
  strategy: ComponentHealth
  /** Certification suite health */
  certification: ComponentHealth
  /** Storage layer health */
  storage: ComponentHealth
}

// ── Invariant Checks ──

export interface InvariantResult {
  /** Did the check pass */
  ok: boolean
  /** Human-readable reason when !ok */
  reason?: string
  /** Numeric delta when applicable (e.g. balance mismatch) */
  delta?: number
}

export interface InvariantSnapshot {
  /** PositionRuntime vs Exchange reconciliation */
  positionSync: InvariantResult
  /** CashLedger vs Exchange balance reconciliation */
  balanceSync: InvariantResult
  /** Open orders reconciliation */
  ordersSync: InvariantResult
  /** TradeJournal append consistency */
  tradeJournalConsistency: InvariantResult
  /** EventStore WAL integrity */
  eventStoreIntegrity: InvariantResult
}

// ── Snapshot ──

/**
 * Raw metrics as returned by CampaignMetricsProvider.
 * These are "raw" values before CampaignSnapshot.create()
 * normalises, rounds, sorts, and validates them.
 */
export interface RawMetrics {
  trading: TradingSnapshot
  runtime: RuntimeSnapshot
  health: HealthSnapshot
  invariants: InvariantSnapshot
}

/**
 * Canonical campaign snapshot.
 *
 * This is the single data structure that gets serialised to disk
 * — both as pretty-printed state.json and as one-line JSONL entries.
 */
export interface CampaignSnapshotData {
  /** Schema version for forward/backward compatibility */
  readonly schemaVersion: number
  /** Snapshot timestamp (Unix ms) */
  readonly timestamp: number
  /** Campaign identity */
  readonly campaign: CampaignContext
  /** Trading metrics */
  readonly trading: TradingSnapshot
  /** Runtime metrics */
  readonly runtime: RuntimeSnapshot
  /** Component health */
  readonly health: HealthSnapshot
  /** Invariant checks */
  readonly invariants: InvariantSnapshot
}
