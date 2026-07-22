// src/event-journal/ReplayEngine.ts
// Phase 5.1 — Core orchestrator.
// ARCHITECTURE RULE: ReplayEngine is the ONLY component that applies events
// to aggregate state during recovery. SnapshotRecovery, SnapshotManager,
// and SQLiteEventJournal only load/save data.
//
// Flow:
//   RecoveryRequest → ReplayEngine
//     ├── EventStream (reads + filters events)
//     ├── EventApplier (applies events to aggregates)
//     ├── ReplayCursor (tracks position, enables resume)
//     ├── ReplayValidator (post-replay validation)
//     └── ReplayReport (result model)

import type { IEventJournal, SnapshotRecord } from './IEventJournal'
import type { EventEnvelope } from './EventEnvelope'
import type { EventApplier } from './EventApplier'
import type { EventStream, EventStreamConfig } from './EventStream'
import { ReplayCursor } from './ReplayCursor'
import type { ReplayValidator, ReplayValidationResult } from './ReplayValidator'
import type { ReplayMetricsCollector } from './ReplayMetrics'
import { NOOP_REPLAY_METRICS } from './ReplayMetrics'
import { ReplayReport, replayOk, AggregateReplayResult } from './ReplayReport'

/* ─── Request / Config ─── */

export interface AggregateInitialState {
  aggregateId: string
  state: unknown
  sequence: number
}

export interface ReplayRequest {
  /** Initial states for aggregates (loaded from snapshot or empty) */
  initialStates?: AggregateInitialState[]

  /** Aggregate IDs to replay (all if omitted) */
  aggregateIds?: string[]

  /** Start sequence (read events after this) */
  fromSequence?: number

  /** End sequence (read events up to this) */
  toSequence?: number

  /** Dry run — don't persist or mutate state, only verify */
  dryRun?: boolean

  /** Batch size for event reads */
  batchSize?: number

  /** Whether to use a cursor for resume support */
  useCursor?: boolean
}

export interface ReplayEngineConfig {
  batchSize: number
  enableMetrics: boolean
}

const DEFAULT_ENGINE_CONFIG: ReplayEngineConfig = {
  batchSize: 500,
  enableMetrics: true,
}

/* ─── Simple state hash (crypto.subtle isn't always available in test) ─── */

function simpleHash(obj: unknown): string {
  const str = JSON.stringify(obj)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

/* ─── ReplayEngine ─── */

export class ReplayEngine {
  private eventStream: EventStream
  private applier: EventApplier
  private cursor: ReplayCursor
  private validator?: ReplayValidator
  private metrics: ReplayMetricsCollector
  private journal: IEventJournal
  private config: ReplayEngineConfig

  constructor(
    journal: IEventJournal,
    eventStream: EventStream,
    applier: EventApplier,
    cursor?: ReplayCursor,
    validator?: ReplayValidator,
    metrics?: ReplayMetricsCollector,
    config?: Partial<ReplayEngineConfig>,
  ) {
    this.journal = journal
    this.eventStream = eventStream
    this.applier = applier
    this.cursor = cursor ?? new ReplayCursor(0)
    this.validator = validator
    this.metrics = metrics ?? NOOP_REPLAY_METRICS
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config }
  }

  /**
   * Full replay: apply events from the given cursor position to all aggregates.
   * This is the main recovery path — used by SnapshotRecovery.
   */
  async replay(request: ReplayRequest = {}): Promise<ReplayReport> {
    const dryRun = request.dryRun ?? false
    const startTime = Date.now()

    // 1. Determine cursor position
    const fromSeq = request.fromSequence ?? this.cursor.current
    const toSeq = request.toSequence ?? Number.MAX_SAFE_INTEGER

    // 2. Load initial states (from snapshot or from request)
    const states = new Map<string, { state: any; sequence: number; eventsApplied: number }>()
    if (request.initialStates) {
      for (const init of request.initialStates) {
        states.set(init.aggregateId, {
          state: dryRun ? this.deepClone(init.state) : init.state,
          sequence: init.sequence,
          eventsApplied: 0,
        })
      }
    } else {
      // Try to load from journal snapshots
      const ids = this.journal.listAggregateIds()
      for (const id of ids) {
        const snap = this.journal.loadSnapshot(id)
        if (snap) {
          let state: unknown
          try {
            state = JSON.parse(snap.payload)
          } catch {
            state = {}
          }
          states.set(id, {
            state: dryRun ? this.deepClone(state) : state,
            sequence: snap.sequence,
            eventsApplied: 0,
          })
        }
      }
    }

    // 3. Read events from stream
    const config: EventStreamConfig = {
      source: 'journal',
      fromSequence: fromSeq > 0 ? fromSeq : undefined,
      toSequence: toSeq < Number.MAX_SAFE_INTEGER ? toSeq : undefined,
      aggregateIds: request.aggregateIds,
      batchSize: request.batchSize ?? this.config.batchSize,
    }

    this.metrics.startReplay()
    const aggregateResults: AggregateReplayResult[] = []
    let totalEvents = 0
    let skippedEvents = 0
    let errors: string[] = []
    let warnings: string[] = []

    // 4. Replay loop
    const aggregateStates = new Map<
      string,
      { seqFrom: number; seqTo: number; eventsApplied: number; durationMs: number; state: any; error?: string }
    >()
    let batchEvents: EventEnvelope[] = []
    let batchSequence = fromSeq

    if (!dryRun) {
      this.cursor.jumpTo(fromSeq)
    }

    for await (const event of this.eventStream.read(config)) {
      if (dryRun) {
        totalEvents++
        continue
      }

      batchEvents.push(event)
      totalEvents++

      // Process batch when it reaches batch size or at end
      if (batchEvents.length >= this.config.batchSize) {
        await this.processBatch(batchEvents, states, aggregateStates, warnings, errors)
        batchEvents = []
      }
    }

    // Process remaining events
    if (!dryRun && batchEvents.length > 0) {
      await this.processBatch(batchEvents, states, aggregateStates, warnings, errors)
    }

    // Build aggregate results from the per-aggregate state map
    for (const [aggId, s] of aggregateStates) {
      aggregateResults.push({
        aggregateId: aggId,
        eventsApplied: s.eventsApplied,
        sequenceFrom: s.seqFrom,
        sequenceTo: s.seqTo,
        durationMs: s.durationMs,
        stateHash: simpleHash(s.state),
        state: s.state,
        error: s.error,
      })
    }

    // 5. Build report
    const now = Date.now()
    const durationMs = now - startTime
    const replayRate = durationMs > 0
      ? Math.round((totalEvents / durationMs) * 1000)
      : 0

    this.metrics.observeReplayDuration(durationMs)

    const report = replayOk({
      ok: errors.length === 0,
      eventsProcessed: totalEvents,
      replayDurationMs: durationMs,
      replayRate,
      aggregatesUpdated: states.size,
      skippedEvents,
      warnings,
      errors,
      aggregateResults,
      fromSequence: fromSeq,
      toSequence: request.toSequence ?? (totalEvents > 0 ? batchSequence : 0),
      dryRun,
      completedAt: now,
    })

    // 6. Optional validation
    if (this.validator && !dryRun) {
      const getHash = (id: string) => {
        const s = states.get(id)
        if (!s) return { hash: '', eventsApplied: 0 }
        return { hash: simpleHash(s.state), eventsApplied: s.eventsApplied }
      }
      const validationResult = this.validator.validate(report, getHash)
      if (!validationResult.valid) {
        report.warnings.push(
          ...Object.values(validationResult.aggregates)
            .flatMap(a => a.warnings),
        )
        report.errors.push(
          ...Object.values(validationResult.aggregates)
            .filter(a => a.errors.length > 0)
            .flatMap(a => a.errors),
        )
        if (report.errors.length > 0) {
          report.ok = false
        }
      }
    }

    return report
  }

  /**
   * Replay a single aggregate by ID.
   * Loads its latest snapshot and replays remaining events.
   */
  async replayAggregate(aggregateId: string, request?: Partial<ReplayRequest>): Promise<ReplayReport> {
    let initialStates: AggregateInitialState[] = []

    // Try to load from snapshot
    const snap = this.journal.loadSnapshot(aggregateId)
    if (snap) {
      let state: unknown
      try {
        state = JSON.parse(snap.payload)
      } catch {
        state = {}
      }
      initialStates.push({
        aggregateId,
        state,
        sequence: snap.sequence,
      })
    }

    return this.replay({
      ...request,
      aggregateIds: [aggregateId],
      initialStates: initialStates.length > 0 ? initialStates : undefined,
      fromSequence: request?.fromSequence ?? (snap ? snap.sequence : 0),
    })
  }

  /**
   * Replay from a specific sequence number (exclusive).
   * Reads events after `sequence`.
   */
  async replayFrom(sequence: number, request?: Partial<ReplayRequest>): Promise<ReplayReport> {
    return this.replay({
      ...request,
      fromSequence: sequence,
    })
  }

  /**
   * Replay up to a specific sequence number (inclusive).
   * Reads events up to `sequence`.
   */
  async replayTo(sequence: number, request?: Partial<ReplayRequest>): Promise<ReplayReport> {
    return this.replay({
      ...request,
      toSequence: sequence,
    })
  }

  /**
   * Dry run — verify replay without mutating state.
   * Events are read and counted but never applied.
   */
  async dryRun(request?: Partial<ReplayRequest>): Promise<ReplayReport> {
    return this.replay({
      ...request,
      dryRun: true,
    })
  }

  /**
   * Determinism check: replay twice and compare state hashes.
   * If hashes match, replay is deterministic.
   */
  async determinismCheck(request?: Partial<ReplayRequest>): Promise<{
    deterministic: boolean
    run1: ReplayReport
    run2: ReplayReport
    stateHash1: string
    stateHash2: string
    mismatch: boolean
  }> {
    // First run — capture state hashes
    const run1 = await this.replay({
      ...request,
      dryRun: false,
    })

    // For determinism check, we collect all state hashes
    const getStateHash = (report: ReplayReport): string => {
      const hashes = report.aggregateResults
        .map(a => a.stateHash)
        .sort()
        .join(':')
      return simpleHash(hashes)
    }

    const stateHash1 = getStateHash(run1)

    // Reset and run again
    this.cursor.reset()

    // Need to reload snapshots for second run
    const run2 = await this.replay({
      ...request,
      dryRun: false,
    })

    const stateHash2 = getStateHash(run2)

    return {
      deterministic: stateHash1 === stateHash2,
      run1,
      run2,
      stateHash1,
      stateHash2,
      mismatch: stateHash1 !== stateHash2,
    }
  }

  /**
   * Validate the current replay state without running a replay.
   */
  validate(): ReplayValidationResult {
    if (!this.validator) {
      return {
        valid: true,
        aggregates: {},
        checksPerformed: 0,
        checksFailed: 0,
        completedAt: Date.now(),
      }
    }

    // Create a minimal report from current cursor state
    const report = replayOk({
      eventsProcessed: this.cursor.progress,
      fromSequence: 0,
      toSequence: this.cursor.current,
    })

    const getHash = () => ({ hash: '', eventsApplied: 0 })
    return this.validator.validate(report, getHash)
  }

  /** Get the current replay cursor */
  getCursor(): ReplayCursor {
    return this.cursor
  }

  /* ─── Private ─── */

  /** Process a batch of events — apply to relevant aggregates */
  private async processBatch(
    events: EventEnvelope[],
    states: Map<string, { state: any; sequence: number; eventsApplied: number }>,
    aggregateStates: Map<string, { seqFrom: number; seqTo: number; eventsApplied: number; durationMs: number; state: any; error?: string }>,
    warnings: string[],
    errors: string[],
  ): Promise<void> {
    this.metrics.startBatch()

    // Track max sequence across all aggregates in this batch for cursor advancement
    let maxSequence = this.cursor.current

    // Group events by aggregate (by tradeId or runtime)
    const grouped = this.groupEvents(events)

    for (const [aggregateId, aggEvents] of grouped) {
      const stateEntry = states.get(aggregateId)
      const batchMaxSeq = aggEvents[aggEvents.length - 1].sequence
      if (batchMaxSeq > maxSequence) {
        maxSequence = batchMaxSeq
      }

      if (!stateEntry) {
        // Aggregate not in our state map — create ephemeral state
        const ephemeral: any = {}
        try {
          const newState = this.applier.apply(aggregateId, ephemeral, aggEvents)
          states.set(aggregateId, {
            state: newState,
            sequence: batchMaxSeq,
            eventsApplied: aggEvents.length,
          })

          // Track ephemeral aggregate in aggregateStates too
          aggregateStates.set(aggregateId, {
            seqFrom: 0,
            seqTo: batchMaxSeq,
            eventsApplied: aggEvents.length,
            durationMs: 0,
            state: newState,
          })
        } catch (err) {
          errors.push(`[${aggregateId}] Apply failed: ${(err as Error).message}`)
          this.metrics.incEventsFailed(aggEvents.length)
        }
        continue
      }

      const fromSeq = stateEntry.sequence
      const applyStart = Date.now()

      // Track per-aggregate cumulative stats
      if (!aggregateStates.has(aggregateId)) {
        aggregateStates.set(aggregateId, {
          seqFrom: fromSeq,
          seqTo: fromSeq,
          eventsApplied: 0,
          durationMs: 0,
          state: stateEntry.state,
        })
      }
      const aggState = aggregateStates.get(aggregateId)!

      try {
        const result = this.applier.apply(aggregateId, stateEntry.state, aggEvents)
        stateEntry.state = result
        stateEntry.sequence = batchMaxSeq
        stateEntry.eventsApplied += aggEvents.length

        // Update cumulative aggregate state
        aggState.seqTo = stateEntry.sequence
        aggState.eventsApplied = stateEntry.eventsApplied
        aggState.durationMs += Date.now() - applyStart
        aggState.state = result
      } catch (err) {
        const msg = `[${aggregateId}] Batch apply failed for ${aggEvents.length} events: ${(err as Error).message}`
        errors.push(msg)
        this.metrics.incEventsFailed(aggEvents.length)
        aggState.error = msg
      }
    }

    // Advance cursor to highest sequence processed in this batch
    this.cursor.jumpTo(maxSequence)
    this.cursor.save()
    this.metrics.endBatch(events.length)
  }

  /** Group events by aggregate */
  private groupEvents(events: EventEnvelope[]): Map<string, EventEnvelope[]> {
    const map = new Map<string, EventEnvelope[]>()

    for (const evt of events) {
      const key = (evt as any).tradeId ?? evt.runtime ?? 'system'
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(evt)
    }

    return map
  }

  /** Deep clone for dry run mode */
  private deepClone<T>(obj: T): T {
    try {
      return JSON.parse(JSON.stringify(obj))
    } catch {
      return { ...obj } as any
    }
  }
}
