/**
 * ChaosTraceMetrics.ts — Metrics collector for Chaos Trace runtime
 *
 * Sprint 6.6.2a — provides counters, gauges, and histograms for
 * the Chaos Trace subsystem. Designed to integrate with the
 * Prometheus / OpenTelemetry export layer via MetricMapper.
 *
 * All metrics are accumulated in-memory and exposed as a snapshot
 * for the MetricsExporter or HealthAggregator.
 *
 * @since 6.6.2a
 */

import type { ChaosTrace, ChaosTraceEvent, ChaosTraceStatus } from './ChaosTrace'
import type { IFailureObserver } from './IFailureObserver'

// ── Snapshot ──

export interface ChaosTraceMetricsSnapshot {
  /** Number of traces currently running */
  activeTraces: number

  /** Total completed traces since last reset */
  completedTraces: number

  /** Total failed traces */
  failedTraces: number

  /** Total cancelled traces */
  cancelledTraces: number

  /** Running average duration of completed traces (ms) */
  avgDurationMs: number

  /** Count of traces by scope */
  byScope: Record<string, number>

  /** Count of traces by action type */
  byAction: Record<string, number>

  /** Max concurrent traces seen (all-time high-water mark) */
  maxConcurrent: number

  /** Total events recorded across all traces */
  totalEvents: number
}

// ════════════════════════════════════════════

export class ChaosTraceMetrics implements IFailureObserver {
  private active = 0
  private completed = 0
  private failed = 0
  private cancelled = 0
  private totalDurationMs = 0
  private durationCount = 0
  private readonly byScope = new Map<string, number>()
  private readonly byAction = new Map<string, number>()
  private maxConcurrent = 0
  private eventCount = 0

  // ── IFailureObserver ──

  onChaosTrace(trace: ChaosTrace): void {
    if (trace.status === 'running') {
      this.active++
      if (this.active > this.maxConcurrent) {
        this.maxConcurrent = this.active
      }
      this.byScope.set(trace.scope, (this.byScope.get(trace.scope) ?? 0) + 1)
      this.byAction.set(trace.actionType, (this.byAction.get(trace.actionType) ?? 0) + 1)
    } else {
      this.active = Math.max(0, this.active - 1)
      switch (trace.status) {
        case 'completed':
          this.completed++
          if (trace.finishedAt && trace.startedAt) {
            this.totalDurationMs += trace.finishedAt - trace.startedAt
            this.durationCount++
          }
          break
        case 'failed':
          this.failed++
          break
        case 'cancelled':
          this.cancelled++
          break
      }
    }
  }

  onChaosEvent(_event: ChaosTraceEvent): void {
    this.eventCount++
  }

  // ── Query ──

  snapshot(): ChaosTraceMetricsSnapshot {
    return {
      activeTraces: this.active,
      completedTraces: this.completed,
      failedTraces: this.failed,
      cancelledTraces: this.cancelled,
      avgDurationMs: this.durationCount > 0
        ? Math.round(this.totalDurationMs / this.durationCount)
        : 0,
      byScope: Object.fromEntries(this.byScope),
      byAction: Object.fromEntries(this.byAction),
      maxConcurrent: this.maxConcurrent,
      totalEvents: this.eventCount,
    }
  }

  reset(): void {
    this.active = 0
    this.completed = 0
    this.failed = 0
    this.cancelled = 0
    this.totalDurationMs = 0
    this.durationCount = 0
    this.byScope.clear()
    this.byAction.clear()
    this.maxConcurrent = 0
    this.eventCount = 0
  }
}
