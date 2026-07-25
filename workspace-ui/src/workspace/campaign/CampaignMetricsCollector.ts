/**
 * CampaignMetricsCollector.ts — Scheduler for campaign metric collection
 *
 * The Collector is the only moving part: it owns the tick loop and
 * delegates all business logic to the Provider and all I/O to the Writer.
 *
 * Responsibilities:
 *   - start() / stop() lifecycle
 *   - Tick scheduling with configurable interval
 *   - Graceful shutdown on stop signal
 *   - Error isolation (a single failed tick never stops the loop)
 *
 * NOT responsible for:
 *   - Any trading/computational logic (→ Provider)
 *   - Any file I/O (→ Writer)
 *
 * @since 4.9
 */

import { CampaignSnapshot } from './CampaignSnapshot'
import type { CampaignContext } from './CampaignContext'
import type { CampaignMetricsProvider } from './CampaignMetricsProvider'
import type { CampaignSnapshotWriter } from './CampaignSnapshotWriter'

export interface CampaignMetricsCollectorConfig {
  /** Collection interval in ms (default: 60 000 = 1 minute) */
  intervalMs?: number
  /** If true, run the first tick immediately on start() (default: true) */
  tickOnStart?: boolean
}

const DEFAULT_INTERVAL_MS = 60_000

export class CampaignMetricsCollector {
  private context: CampaignContext
  private provider: CampaignMetricsProvider
  private writer: CampaignSnapshotWriter
  private config: CampaignMetricsCollectorConfig

  private timerId: ReturnType<typeof setInterval> | null = null
  private running = false
  private tickCount = 0
  private lastTickDurationMs = 0
  private lastTickTime = 0
  private totalTickDurationMs = 0

  constructor(
    context: CampaignContext,
    provider: CampaignMetricsProvider,
    writer: CampaignSnapshotWriter,
    config: CampaignMetricsCollectorConfig = {},
  ) {
    this.context = context
    this.provider = provider
    this.writer = writer
    this.config = {
      intervalMs: DEFAULT_INTERVAL_MS,
      tickOnStart: true,
      ...config,
    }
  }

  /**
   * Start the collection loop.
   * If tickOnStart is true (default), the first tick fires immediately.
   */
  start(): void {
    if (this.running) {
      console.warn('[CampaignMetricsCollector] Already running')
      return
    }

    this.running = true
    console.log(
      `[CampaignMetricsCollector] Started (interval: ${this.config.intervalMs}ms, ` +
      `state: ${this.writer.directory})`,
    )

    // First tick
    if (this.config.tickOnStart) {
      this.tick()
    }

    // Schedule recurring ticks
    this.timerId = setInterval(() => this.tick(), this.config.intervalMs)
  }

  /**
   * Stop the collection loop gracefully.
   * Flushes pending writes before returning.
   */
  stop(): void {
    if (!this.running) return

    this.running = false
    if (this.timerId !== null) {
      clearInterval(this.timerId)
      this.timerId = null
    }

    // Flush writer
    this.writer.flush()

    console.log(
      `[CampaignMetricsCollector] Stopped (${this.tickCount} ticks, ` +
      `avg ${this.tickCount > 0 ? Math.round(this.totalTickDurationMs / this.tickCount) : 0}ms/tick)`,
    )
  }

  /**
   * Force an immediate tick (outside the regular schedule).
   * Safe to call while the loop is running.
   */
  tick(): void {
    const start = Date.now()
    this.tickCount++

    try {
      // 1. Collect raw metrics from platform components
      const raw = this.provider.collect()

      // 2. Build canonical snapshot (normalises, validates)
      const snapshot = CampaignSnapshot.create(this.context, raw)

      // 3. Write both state.json and snapshots.jsonl
      this.writer.writeState(snapshot)
      this.writer.appendSnapshot(snapshot)

      this.lastTickTime = Date.now()
      this.lastTickDurationMs = Date.now() - start
      this.totalTickDurationMs += this.lastTickDurationMs
    } catch (err) {
      console.error(`[CampaignMetricsCollector] Tick #${this.tickCount} failed:`, err)
    }
  }

  // ── Status ──

  get isRunning(): boolean {
    return this.running
  }

  get stats(): CollectorStats {
    return {
      tickCount: this.tickCount,
      lastTickDurationMs: this.lastTickDurationMs,
      lastTickTime: this.lastTickTime,
      averageTickDurationMs: this.tickCount > 0
        ? Math.round(this.totalTickDurationMs / this.tickCount)
        : 0,
      stateDir: this.writer.directory,
    }
  }
}

export interface CollectorStats {
  tickCount: number
  lastTickDurationMs: number
  lastTickTime: number
  averageTickDurationMs: number
  stateDir: string
}
