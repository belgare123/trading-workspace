// src/event-journal/ReplayMetrics.ts
// Phase 5 — Replay performance & operational metrics

/** Contract for replay metrics collection */
export interface ReplayMetricsCollector {
  incEventsReplayed(count: number): void
  incEventsSkipped(count: number): void
  incEventsFailed(count: number): void
  observeReplayDuration(ms: number): void
  observeReplayLatency(ms: number): void
  observeBatchSize(size: number): void
  startReplay(): void
  startBatch(): void
  endBatch(size: number): void
  snapshot(): ReplayMetricsSnapshot
  reset(): void
}

export interface ReplayMetricsSnapshot {
  /** Total events replayed since last reset */
  eventsReplayedTotal: number
  /** Total events skipped since last reset */
  eventsSkippedTotal: number
  /** Total events that failed during apply since last reset */
  eventsFailedTotal: number
  /** Number of batches processed */
  batchesProcessed: number
  /** Total replay wall-clock duration in ms */
  totalReplayDurationMs: number
  /** Total batch time (sum of individual batch durations) */
  totalBatchTimeMs: number
  /** Min/avg/max batch durations */
  minBatchDurationMs: number
  avgBatchDurationMs: number
  maxBatchDurationMs: number
  /** Event processing rate (events/sec) */
  eventRate: number
  /** Last reset timestamp */
  lastResetAt: number
}

export const NOOP_REPLAY_METRICS: ReplayMetricsCollector = {
  incEventsReplayed: () => {},
  incEventsSkipped: () => {},
  incEventsFailed: () => {},
  observeReplayDuration: () => {},
  observeReplayLatency: () => {},
  observeBatchSize: () => {},
  startReplay: () => {},
  startBatch: () => {},
  endBatch: () => {},
  snapshot: () => ({
    eventsReplayedTotal: 0,
    eventsSkippedTotal: 0,
    eventsFailedTotal: 0,
    batchesProcessed: 0,
    totalReplayDurationMs: 0,
    totalBatchTimeMs: 0,
    minBatchDurationMs: 0,
    avgBatchDurationMs: 0,
    maxBatchDurationMs: 0,
    eventRate: 0,
    lastResetAt: Date.now(),
  }),
  reset: () => {},
}

export class ReplayMetrics implements ReplayMetricsCollector {
  private eventsReplayedTotal = 0
  private eventsSkippedTotal = 0
  private eventsFailedTotal = 0
  private batchesProcessed = 0
  private totalReplayDurationMs = 0
  private totalBatchTimeMs = 0
  private minBatchDurationMs = Number.MAX_SAFE_INTEGER
  private maxBatchDurationMs = 0
  private lastResetAt = Date.now()
  private batchStart = 0
  private replayStart = 0

  incEventsReplayed(count: number): void {
    this.eventsReplayedTotal += count
  }

  incEventsSkipped(count: number): void {
    this.eventsSkippedTotal += count
  }

  incEventsFailed(count: number): void {
    this.eventsFailedTotal += count
  }

  /** Call before replay starts */
  startReplay(): void {
    if (this.replayStart === 0) {
      this.replayStart = Date.now()
    }
  }

  /** Call when a batch of events begins */
  startBatch(): void {
    this.batchStart = Date.now()
  }

  /** Call when a batch completes */
  endBatch(size: number): void {
    const duration = Date.now() - this.batchStart
    this.batchesProcessed++
    this.totalBatchTimeMs += duration
    if (duration < this.minBatchDurationMs) this.minBatchDurationMs = duration
    if (duration > this.maxBatchDurationMs) this.maxBatchDurationMs = duration
    this.incEventsReplayed(size)
    this.observeReplayDuration(duration)
  }

  observeReplayDuration(ms: number): void {
    this.totalReplayDurationMs += ms
  }

  observeReplayLatency(ms: number): void {
    // Latency tracking is a no-op in the simple collector
  }

  observeBatchSize(size: number): void {
    // Size tracking is optional in the simple collector
  }

  snapshot(): ReplayMetricsSnapshot {
    const elapsed = Date.now() - this.lastResetAt
    return {
      eventsReplayedTotal: this.eventsReplayedTotal,
      eventsSkippedTotal: this.eventsSkippedTotal,
      eventsFailedTotal: this.eventsFailedTotal,
      batchesProcessed: this.batchesProcessed,
      totalReplayDurationMs: this.totalReplayDurationMs,
      totalBatchTimeMs: this.totalBatchTimeMs,
      minBatchDurationMs:
        this.minBatchDurationMs === Number.MAX_SAFE_INTEGER
          ? 0
          : this.minBatchDurationMs,
      avgBatchDurationMs:
        this.batchesProcessed > 0
          ? Math.round(this.totalBatchTimeMs / this.batchesProcessed)
          : 0,
      maxBatchDurationMs: this.maxBatchDurationMs,
      eventRate: elapsed > 0 ? Math.round((this.eventsReplayedTotal / elapsed) * 1000) : 0,
      lastResetAt: this.lastResetAt,
    }
  }

  reset(): void {
    this.eventsReplayedTotal = 0
    this.eventsSkippedTotal = 0
    this.eventsFailedTotal = 0
    this.batchesProcessed = 0
    this.totalReplayDurationMs = 0
    this.totalBatchTimeMs = 0
    this.minBatchDurationMs = Number.MAX_SAFE_INTEGER
    this.maxBatchDurationMs = 0
    this.replayStart = 0
    this.lastResetAt = Date.now()
  }
}
