// src/event-journal/RecoveryReport.ts
// Phase 4.7 — Structured model for recovery results

import type { AggregateSnapshotOutput } from './SnapshotManager'

export interface RecoveryReport {
  /** Overall success (true if no errors) */
  ok: boolean

  /** Highest snapshot sequence recovered */
  snapshotSequence: number

  /** Minimum last_applied_sequence across all recovered snapshots (replay cursor) */
  lastAppliedSequence: number

  /** Number of events replayed after snapshot (filled by ReplayEngine) */
  replayedEvents: number

  /** Duration of replay in ms (filled by ReplayEngine) */
  replayDurationMs: number

  /** Number of aggregates successfully recovered */
  recoveredAggregates: number

  /** Total aggregates that had snapshots */
  totalAggregates: number

  /** Warnings (non-fatal issues) */
  warnings: string[]

  /** Errors (fatal issues preventing full recovery) */
  errors: string[]

  /** Per-aggregate recovery details */
  aggregates: AggregateSnapshotOutput[]

  /** When recovery completed */
  recoveredAt: number
}

/** Factory for success case */
export function recoveryOk(overrides?: Partial<RecoveryReport>): RecoveryReport {
  return {
    ok: true,
    snapshotSequence: 0,
    lastAppliedSequence: 0,
    replayedEvents: 0,
    replayDurationMs: 0,
    recoveredAggregates: 0,
    totalAggregates: 0,
    warnings: [],
    errors: [],
    aggregates: [],
    recoveredAt: Date.now(),
    ...overrides,
  }
}
