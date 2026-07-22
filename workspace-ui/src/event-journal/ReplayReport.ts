// src/event-journal/ReplayReport.ts
// Phase 5.6 — Result model for ReplayEngine operations

export interface AggregateReplayResult {
  aggregateId: string
  eventsApplied: number
  sequenceFrom: number
  sequenceTo: number
  durationMs: number
  stateHash: string
  /** Final aggregate state after all events applied */
  state?: unknown
  error?: string
}

export interface ReplayReport {
  /** Overall success (true if no errors) */
  ok: boolean

  /** Number of events processed during replay */
  eventsProcessed: number

  /** Duration of replay in ms */
  replayDurationMs: number

  /** Replay throughput (events/sec) */
  replayRate: number

  /** Number of aggregates that were updated */
  aggregatesUpdated: number

  /** Events that were skipped */
  skippedEvents: number

  /** Warnings (non-fatal issues) */
  warnings: string[]

  /** Errors (fatal issues) */
  errors: string[]

  /** Per-aggregate replay details */
  aggregateResults: AggregateReplayResult[]

  /** Replay range */
  fromSequence: number
  toSequence: number

  /** Whether this was a dry run (no state persisted) */
  dryRun: boolean

  /** When replay completed */
  completedAt: number
}

/** Factory for empty/default ReplayReport */
export function replayOk(overrides?: Partial<ReplayReport>): ReplayReport {
  return {
    ok: true,
    eventsProcessed: 0,
    replayDurationMs: 0,
    replayRate: 0,
    aggregatesUpdated: 0,
    skippedEvents: 0,
    warnings: [],
    errors: [],
    aggregateResults: [],
    fromSequence: 0,
    toSequence: 0,
    dryRun: false,
    completedAt: Date.now(),
    ...overrides,
  }
}
