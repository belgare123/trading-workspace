// src/event-journal/SnapshotPolicy.ts
// Phase 4.1 — Pure deterministic decision engine: "should we snapshot now?"
// No side effects. No storage knowledge. Fully testable.

import type { RuntimeId } from './types'

/* ─── Configuration ─── */

export interface SnapshotPolicyConfig {
  /** Max events between snapshots (default 100) */
  maxEventsBeforeSnapshot: number
  /** Max milliseconds between snapshots (default 5 min) */
  maxIntervalMs: number
  /** Snapshot on trade close (default true) */
  snapshotOnTradeClose: boolean
  /** Snapshot on position change (default true) */
  snapshotOnPositionChange: boolean
  /** Snapshot on shutdown (default true) */
  snapshotOnShutdown: boolean
  /** Snapshot on emergency stop (default true) */
  snapshotOnEmergencyStop: boolean
  /** Snapshot when any runtime reports dirty state (default true) */
  snapshotOnDirtyState: boolean
}

export const DEFAULT_SNAPSHOT_POLICY: SnapshotPolicyConfig = {
  maxEventsBeforeSnapshot: 100,
  maxIntervalMs: 300_000, // 5 min
  snapshotOnTradeClose: true,
  snapshotOnPositionChange: true,
  snapshotOnShutdown: true,
  snapshotOnEmergencyStop: true,
  snapshotOnDirtyState: true,
}

/* ─── Context & Decision ─── */

export type SnapshotPriority = 'low' | 'medium' | 'high' | 'critical'

export interface SnapshotDecision {
  shouldSnapshot: boolean
  reason: string
  priority: SnapshotPriority
}

export interface SnapshotContext {
  /** Current journal sequence number */
  currentSequence: number
  /** Sequence of the last saved snapshot (0 = no snapshot yet) */
  lastSnapshotSequence: number
  /** Timestamp of the last saved snapshot (0 = no snapshot yet) */
  lastSnapshotTimestamp: number
  /** Events appended since the last snapshot */
  eventsSinceSnapshot: number
  /** Active (open) trade IDs */
  activeTradeIds: string[]
  /** Active (open) position IDs */
  activePositionIds: string[]
  /** Runtimes currently in a dirty state */
  dirtyRuntimes: RuntimeId[]
  /** System is shutting down */
  isShuttingDown: boolean
  /** Emergency stop is active */
  isEmergencyStop: boolean
  /** At least one trade was just closed */
  isTradeClosed: boolean
  /** At least one position changed state */
  isPositionChanged: boolean
}

/* ─── Policy ─── */

export class SnapshotPolicy {
  private config: SnapshotPolicyConfig

  constructor(config?: Partial<SnapshotPolicyConfig>) {
    this.config = { ...DEFAULT_SNAPSHOT_POLICY, ...config }
  }

  /** Deterministic decision: should we snapshot now? */
  shouldSnapshot(ctx: SnapshotContext): SnapshotDecision {
    // Priority order: critical > high > medium > low

    // ─── Critical triggers ───
    if (this.config.snapshotOnEmergencyStop && ctx.isEmergencyStop) {
      return { shouldSnapshot: true, reason: 'Emergency stop active', priority: 'critical' }
    }
    if (this.config.snapshotOnShutdown && ctx.isShuttingDown) {
      return { shouldSnapshot: true, reason: 'System shutting down', priority: 'critical' }
    }

    // ─── High triggers ───
    if (this.config.snapshotOnTradeClose && ctx.isTradeClosed) {
      return { shouldSnapshot: true, reason: 'Trade closed', priority: 'high' }
    }
    if (this.config.snapshotOnPositionChange && ctx.isPositionChanged) {
      return { shouldSnapshot: true, reason: 'Position changed', priority: 'high' }
    }
    if (this.config.snapshotOnDirtyState && ctx.dirtyRuntimes.length > 0) {
      return {
        shouldSnapshot: true,
        reason: `Dirty runtimes: [${ctx.dirtyRuntimes.join(', ')}]`,
        priority: 'high',
      }
    }

    // ─── Medium triggers ───
    const eventsSince = ctx.eventsSinceSnapshot
    if (eventsSince >= this.config.maxEventsBeforeSnapshot) {
      return {
        shouldSnapshot: true,
        reason: `${eventsSince} events since last snapshot (threshold: ${this.config.maxEventsBeforeSnapshot})`,
        priority: 'medium',
      }
    }

    const elapsed = ctx.lastSnapshotTimestamp === 0
      ? 0
      : Date.now() - ctx.lastSnapshotTimestamp
    if (elapsed >= this.config.maxIntervalMs) {
      return {
        shouldSnapshot: true,
        reason: `${Math.floor(elapsed / 1000)}s since last snapshot (threshold: ${this.config.maxIntervalMs / 1000}s)`,
        priority: 'medium',
      }
    }

    // ─── No snapshot needed ───
    return { shouldSnapshot: false, reason: 'No trigger condition met', priority: 'low' }
  }
}
