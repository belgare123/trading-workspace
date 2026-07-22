// src/event-journal/SnapshotManager.ts
// Phase 4.2 — Main orchestrator. No SQL. Pure IEventJournal + Policy + Serializer + Validator.

import type { IEventJournal, SnapshotRecord } from './IEventJournal'
import type { SnapshotPolicy, SnapshotContext, SnapshotDecision } from './SnapshotPolicy'
import type { SnapshotSerializer, SerializedSnapshot } from './SnapshotSerializer'
import type { SnapshotValidator, ValidationResult } from './SnapshotValidator'
import type { RecoveryReport } from './RecoveryReport'

/* ─── Metrics ─── */

export interface SnapshotMetricsCollector {
  incCreateTotal(priority: string): void
  incRestoreTotal(source: 'latest' | 'aggregate'): void
  incValidationFailed(reason: string): void
  observeDuration(ms: number): void
  observeRestoreDuration(ms: number): void
  observeSizeBytes(bytes: number): void
  incPrunedTotal(count: number): void
}

export const NOOP_SNAPSHOT_METRICS: SnapshotMetricsCollector = {
  incCreateTotal: () => {},
  incRestoreTotal: () => {},
  incValidationFailed: () => {},
  observeDuration: () => {},
  observeRestoreDuration: () => {},
  observeSizeBytes: () => {},
  incPrunedTotal: () => {},
}

/* ─── Aggregate Snapshot Input ─── */

export interface AggregateSnapshotInput {
  aggregateId: string
  state: unknown
  sequence: number
  snapshotVersion?: number
}

export interface AggregateSnapshotOutput {
  aggregateId: string
  record: SnapshotRecord
  state: unknown
  valid: boolean
  validationErrors: string[]
}

/* ─── SnapshotManager ─── */

export interface SnapshotManagerConfig {
  /** Default snapshot version to write (default 1) */
  defaultSnapshotVersion: number
  /** How many snapshots to keep per aggregate during prune (default 3) */
  pruneKeepLast: number
  /** Enable automatic snapshot metrics */
  enableMetrics: boolean
}

const DEFAULT_MANAGER_CONFIG: SnapshotManagerConfig = {
  defaultSnapshotVersion: 1,
  pruneKeepLast: 3,
  enableMetrics: true,
}

export class SnapshotManager {
  private journal: IEventJournal
  private policy: SnapshotPolicy
  private serializer: SnapshotSerializer
  private validator: SnapshotValidator
  private metrics: SnapshotMetricsCollector
  private config: SnapshotManagerConfig

  constructor(
    journal: IEventJournal,
    policy: SnapshotPolicy,
    serializer: SnapshotSerializer,
    validator: SnapshotValidator,
    metrics?: SnapshotMetricsCollector,
    config?: Partial<SnapshotManagerConfig>,
  ) {
    this.journal = journal
    this.policy = policy
    this.serializer = serializer
    this.validator = validator
    this.metrics = metrics ?? NOOP_SNAPSHOT_METRICS
    this.config = { ...DEFAULT_MANAGER_CONFIG, ...config }
  }

  /* ─── Lifecycle ─── */

  /** Check policy and conditionally create snapshots. Call after processing events. */
  evaluate(ctx: SnapshotContext): SnapshotDecision {
    return this.policy.shouldSnapshot(ctx)
  }

  /**
   * Create snapshots for one or more aggregates.
   * Returns the saved SnapshotRecord for each aggregate.
   */
  createSnapshot(
    aggregates: AggregateSnapshotInput[],
    reason: string,
  ): SnapshotRecord[] {
    const start = Date.now()
    const records: SnapshotRecord[] = []
    const priority = aggregates.length > 0 ? 'manual' : 'none'

    for (const agg of aggregates) {
      const serialized = this.serializer.serialize(agg.state)
      const seq = agg.sequence

      const record: SnapshotRecord = {
        snapshot_id: `${agg.aggregateId}-${seq}-${start}`,
        aggregate_id: agg.aggregateId,
        sequence: seq,
        snapshot_version: agg.snapshotVersion ?? this.config.defaultSnapshotVersion,
        checksum: serialized.checksum,
        last_applied_sequence: seq,
        created_at: start,
        payload: serialized.data,
      }

      this.journal.saveSnapshot(record)
      records.push(record)

      this.metrics.observeSizeBytes(serialized.data.length)

      if (this.config.enableMetrics) {
        this.metrics.incCreateTotal(priority)
      }
    }

    this.metrics.observeDuration(Date.now() - start)

    return records
  }

  /**
   * Create an atomic checkpoint: append events AND save snapshots in one transaction.
   * The sequence is shared — snapshot.last_applied_sequence = max(events.sequence).
   */
  checkpoint(
    events: Omit<import('./EventEnvelope').EventEnvelope, 'sequence'>[],
    aggregates: AggregateSnapshotInput[],
  ): import('./IEventJournal').CheckpointResult {
    const start = Date.now()

    // Serialize all aggregate snapshots first (serialization is deterministic, no side effects)
    const serializedSnapshots: { input: AggregateSnapshotInput; serialized: SerializedSnapshot }[] = []
    for (const agg of aggregates) {
      const serialized = this.serializer.serialize(agg.state)
      serializedSnapshots.push({ input: agg, serialized })
    }

    // The journal's checkpoint handles the atomic transaction
    // For simplicity, we save snapshots one-by-one since the journal might not
    // support multi-snapshot checkpoint. We'll use the first aggregate for the
    // checkpoint and save the rest separately.
    if (serializedSnapshots.length === 0) {
      const result = this.journal.checkpoint(events, {
        snapshot_id: `checkpoint-${start}`,
        aggregate_id: 'system',
        sequence: 0,
        snapshot_version: this.config.defaultSnapshotVersion,
        checksum: null,
        created_at: start,
        payload: '{}',
      })
      return result
    }

    // First aggregate goes into the atomic checkpoint
    const first = serializedSnapshots[0]
    const checkpointResult = this.journal.checkpoint(events, {
      snapshot_id: `cp-${first.input.aggregateId}-${first.input.sequence}-${start}`,
      aggregate_id: first.input.aggregateId,
      sequence: first.input.sequence,
      snapshot_version: first.input.snapshotVersion ?? this.config.defaultSnapshotVersion,
      checksum: first.serialized.checksum,
      last_applied_sequence: first.input.sequence,
      created_at: start,
      payload: first.serialized.data,
    })

    this.metrics.incCreateTotal('checkpoint')
    this.metrics.observeSizeBytes(first.serialized.data.length)

    // Remaining aggregates saved separately
    for (let i = 1; i < serializedSnapshots.length; i++) {
      const agg = serializedSnapshots[i]
      const record: SnapshotRecord = {
        snapshot_id: `cp-${agg.input.aggregateId}-${agg.input.sequence}-${start}`,
        aggregate_id: agg.input.aggregateId,
        sequence: agg.input.sequence,
        snapshot_version: agg.input.snapshotVersion ?? this.config.defaultSnapshotVersion,
        checksum: agg.serialized.checksum,
        last_applied_sequence: agg.input.sequence,
        created_at: start,
        payload: agg.serialized.data,
      }
      this.journal.saveSnapshot(record)
      this.metrics.observeSizeBytes(agg.serialized.data.length)
    }

    this.metrics.observeDuration(Date.now() - start)

    return checkpointResult
  }

  /**
   * Load and deserialize the latest snapshot for ALL aggregates.
   * Validates each snapshot and reports any issues.
   */
  restoreLatest(): RecoveryReport {
    const start = Date.now()

    const aggregateIds = this.journal.listAggregateIds()
    const recovered: AggregateSnapshotOutput[] = []
    const errors: string[] = []
    const warnings: string[] = []
    let maxSequence = 0
    let minLastApplied = Number.MAX_SAFE_INTEGER

    for (const id of aggregateIds) {
      const record = this.journal.loadSnapshot(id)
      if (!record) {
        warnings.push(`Aggregate '${id}' has no snapshot (listed but empty)`)
        continue
      }

      // Validate
      const validation = this.validator.validate(record)
      if (!validation.valid) {
        errors.push(...validation.errors.map(e => `[${id}] ${e}`))
        warnings.push(...validation.warnings.map(w => `[${id}] ${w}`))
        this.metrics.incValidationFailed(validation.errors[0] ?? 'unknown')

        recovered.push({
          aggregateId: id,
          record,
          state: null,
          valid: false,
          validationErrors: validation.errors,
        })
        continue
      }
      warnings.push(...validation.warnings.map(w => `[${id}] ${w}`))

      // Deserialize
      let state: unknown = null
      try {
        state = this.serializer.deserialize({
          data: record.payload,
          checksum: record.checksum ?? '',
          algorithm: 'none',
        })
      } catch (err) {
        errors.push(`[${id}] Deserialization failed: ${(err as Error).message}`)
        this.metrics.incValidationFailed('deserialize')

        recovered.push({
          aggregateId: id,
          record,
          state: null,
          valid: false,
          validationErrors: [(err as Error).message],
        })
        continue
      }

      recovered.push({
        aggregateId: id,
        record,
        state,
        valid: true,
        validationErrors: [],
      })

      if (record.sequence > maxSequence) maxSequence = record.sequence
      if (record.last_applied_sequence !== null && record.last_applied_sequence < minLastApplied) {
        minLastApplied = record.last_applied_sequence
      }
    }

    if (minLastApplied === Number.MAX_SAFE_INTEGER) minLastApplied = 0

    this.metrics.incRestoreTotal('latest')
    this.metrics.observeRestoreDuration(Date.now() - start)

    return {
      ok: errors.length === 0,
      snapshotSequence: maxSequence,
      lastAppliedSequence: minLastApplied,
      replayedEvents: 0, // filled by ReplayEngine
      replayDurationMs: 0, // filled by ReplayEngine
      recoveredAggregates: recovered.filter(r => r.valid).length,
      totalAggregates: aggregateIds.length,
      warnings,
      errors,
      aggregates: recovered,
      recoveredAt: Date.now(),
    }
  }

  /**
   * Load and deserialize a single aggregate's latest snapshot.
   */
  restoreAggregate(aggregateId: string): AggregateSnapshotOutput | null {
    const start = Date.now()
    const record = this.journal.loadSnapshot(aggregateId)

    if (!record) return null

    const validation = this.validator.validate(record)
    if (!validation.valid) {
      this.metrics.incValidationFailed(validation.errors[0] ?? 'unknown')
      return {
        aggregateId,
        record,
        state: null,
        valid: false,
        validationErrors: validation.errors,
      }
    }

    try {
      const state = this.serializer.deserialize({
        data: record.payload,
        checksum: record.checksum ?? '',
        algorithm: 'none',
      })

      this.metrics.incRestoreTotal('aggregate')
      this.metrics.observeRestoreDuration(Date.now() - start)

      return {
        aggregateId,
        record,
        state,
        valid: true,
        validationErrors: [],
      }
    } catch (err) {
      this.metrics.incValidationFailed('deserialize')
      return {
        aggregateId,
        record,
        state: null,
        valid: false,
        validationErrors: [(err as Error).message],
      }
    }
  }

  /**
   * Validate all stored snapshots across all aggregates.
   */
  validate(): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {}
    const ids = this.journal.listAggregateIds()

    for (const id of ids) {
      const record = this.journal.loadSnapshot(id)
      if (!record) {
        results[id] = { valid: false, errors: ['No snapshot found'], warnings: [] }
        this.metrics.incValidationFailed('missing')
        continue
      }

      const validation = this.validator.validate(record)
      results[id] = validation
      if (!validation.valid) {
        this.metrics.incValidationFailed(validation.errors[0] ?? 'unknown')
      }
    }

    return results
  }

  /**
   * Prune old snapshots, keeping only the most recent per aggregate.
   */
  prune(keepLast?: number): number {
    const keep = keepLast ?? this.config.pruneKeepLast
    const count = this.journal.pruneSnapshots(keep)
    this.metrics.incPrunedTotal(count)
    return count
  }

  /**
   * Graceful shutdown — creates final snapshots for active aggregates.
   */
  shutdown(aggregates: AggregateSnapshotInput[]): SnapshotRecord[] {
    if (aggregates.length === 0) return []
    return this.createSnapshot(aggregates, 'System shutdown')
  }
}
