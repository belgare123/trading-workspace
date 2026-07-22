/**
 * ChaosTraceHealth.ts — Health integration for Chaos Trace runtime
 *
 * Sprint 6.6.2a — exposes health checks for the Chaos Trace
 * subsystem. Reports stale traces (running longer than threshold)
 * and overall capacity.
 *
 * Integrates with the HealthAggregator pattern used by the
 * TelemetryRuntime and other runtime components.
 *
 * @since 6.6.2a
 */

import type { ChaosTraceRuntime } from './ChaosTraceRuntime'

// ── Thresholds ──

const DEFAULT_STALE_THRESHOLD_MS = 30_000 // 30 seconds

// ── Health result ──

export interface ChaosTraceHealthResult {
  healthy: boolean
  activeTraces: number
  staleTraces: number
  staleTraceIds: string[]
  timestamp: number
}

// ════════════════════════════════════════════

export class ChaosTraceHealth {
  private readonly runtime: ChaosTraceRuntime
  private readonly staleThresholdMs: number

  constructor(
    runtime: ChaosTraceRuntime,
    staleThresholdMs: number = DEFAULT_STALE_THRESHOLD_MS,
  ) {
    this.runtime = runtime
    this.staleThresholdMs = staleThresholdMs
  }

  /** Run a health check */
  check(): ChaosTraceHealthResult {
    const now = Date.now()
    const activeTraces = this.runtime.getActiveTraces()
    const staleTraces = activeTraces.filter(
      t => (now - t.startedAt) > this.staleThresholdMs,
    )

    return {
      healthy: staleTraces.length === 0,
      activeTraces: activeTraces.length,
      staleTraces: staleTraces.length,
      staleTraceIds: staleTraces.map(t => t.id),
      timestamp: now,
    }
  }

  /** Deep check: returns detailed per-trace info for report */
  deepCheck(): ChaosTraceHealthResult & { traces: Array<{ id: string; ageMs: number; ruleId: string }> } {
    const now = Date.now()
    const activeTraces = this.runtime.getActiveTraces()
    const staleTraces = activeTraces.filter(
      t => (now - t.startedAt) > this.staleThresholdMs,
    )

    return {
      healthy: staleTraces.length === 0,
      activeTraces: activeTraces.length,
      staleTraces: staleTraces.length,
      staleTraceIds: staleTraces.map(t => t.id),
      timestamp: now,
      traces: activeTraces.map(t => ({
        id: t.id,
        ageMs: now - t.startedAt,
        ruleId: t.ruleId,
      })),
    }
  }
}
