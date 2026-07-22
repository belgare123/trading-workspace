// src/event-journal/SQLiteEventJournal.ts
// SQLite-backed implementation of IEventJournal with hybrid flush,
// JournalFilter, health checks, metrics, atomic checkpoint, versioned snapshots.

import Database from 'better-sqlite3'
import type { EventEnvelope, EventEnvelopeMetadata } from './EventEnvelope'
import type { IEventJournal, JournalRecoveryResult, SnapshotRecord, CheckpointResult } from './IEventJournal'
import type { JournalFilter } from './types'
import { CRITICAL_EVENT_TYPES } from './types'
import { SchemaManager } from './SchemaManager'

/* ── Types ── */

export interface SQLiteEventJournalConfig {
  /** Path to the SQLite database file (':memory:' for testing) */
  dbPath: string
  /** Max non-critical events buffered before auto-flush. Default 50. */
  maxBufferedEvents?: number
  /** Max interval (ms) between auto-flushes. Default 100. */
  maxFlushIntervalMs?: number
  /** Flush on critical events. Default true. */
  flushOnCritical?: boolean
  /** Flush before shutdown. Default true. */
  flushOnShutdown?: boolean
  /** SQLite synchronous mode. Default 'NORMAL'. */
  synchronousMode?: 'NORMAL' | 'FULL'
  /** Optional metrics collector */
  metrics?: JournalMetricsCollector
}

export interface JournalHealth {
  healthy: boolean
  db_size_mb: number
  events: number
  snapshots: number
  last_flush_ms: number | null
  queue_depth: number
  wal_checkpoint_age: number
  schema_version: number
  last_applied_sequence: number
}

export interface JournalMetricsCollector {
  incAppendTotal(labels?: Record<string, string>): void
  observeAppendLatency(ms: number): void
  incFlushTotal(): void
  observeFlushLatency(ms: number): void
  incReadTotal(): void
  observeReadLatency(ms: number): void
  incPruneTotal(): void
  incErrorsTotal(): void
  incCheckpointTotal(): void
  setEventsGauge(count: number): void
  setSnapshotsGauge(count: number): void
  setDbSizeGauge(mb: number): void
  setQueueDepthGauge(depth: number): void
}

/** Default no-op metrics collector */
export const NOOP_METRICS: JournalMetricsCollector = {
  incAppendTotal: () => {},
  observeAppendLatency: () => {},
  incFlushTotal: () => {},
  observeFlushLatency: () => {},
  incReadTotal: () => {},
  observeReadLatency: () => {},
  incPruneTotal: () => {},
  incErrorsTotal: () => {},
  incCheckpointTotal: () => {},
  setEventsGauge: () => {},
  setSnapshotsGauge: () => {},
  setDbSizeGauge: () => {},
  setQueueDepthGauge: () => {},
}

/* ── Constants ── */

const DEFAULT_MAX_BUFFERED = 50
const DEFAULT_FLUSH_INTERVAL = 100

/* ── Row shape from SQLite ── */

interface EventRow {
  id: number
  event_id: string
  trace_id: string | null
  causation_id: string | null
  runtime_id: string
  event_type: string
  aggregate_type: string | null
  aggregate_id: string | null
  sequence: number
  timestamp: number
  critical: number
  payload: string | null
  metadata: string | null
}

interface SnapshotRow {
  snapshot_id: string
  aggregate_id: string
  sequence: number
  snapshot_version: number
  checksum: string | null
  last_applied_sequence: number | null
  created_at: number
  payload: string | null
}

/* ── Main class ── */

export class SQLiteEventJournal implements IEventJournal {
  private db: Database.Database
  private schemaManager: SchemaManager
  private config: Required<SQLiteEventJournalConfig>
  private buffer: Omit<EventEnvelope, 'sequence'>[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private lastFlushTime: number | null = null
  private closed = false

  /* ── Prepared statements ── */

  private stmtInsertEvent!: Database.Statement
  private stmtInsertEventImmediate!: Database.Statement
  private stmtInsertSnapshot!: Database.Statement
  private stmtSequence!: Database.Statement
  private stmtCountEvents!: Database.Statement
  private stmtCountSnapshots!: Database.Statement
  private stmtEventById!: Database.Statement
  private stmtSnapshotByAggregate!: Database.Statement
  private stmtSnapshotById!: Database.Statement
  private stmtDeleteOldSnapshots!: Database.Statement
  private stmtMaxApplied!: Database.Statement

  /* ── RuntimeTelemetry reporter (lazy) ── */

  private _metrics: JournalMetricsCollector

  constructor(config: SQLiteEventJournalConfig) {
    this.config = {
      dbPath: config.dbPath,
      maxBufferedEvents: config.maxBufferedEvents ?? DEFAULT_MAX_BUFFERED,
      maxFlushIntervalMs: config.maxFlushIntervalMs ?? DEFAULT_FLUSH_INTERVAL,
      flushOnCritical: config.flushOnCritical ?? true,
      flushOnShutdown: config.flushOnShutdown ?? true,
      synchronousMode: config.synchronousMode ?? 'NORMAL',
      metrics: config.metrics ?? NOOP_METRICS,
    }

    this._metrics = this.config.metrics
    this.db = new Database(this.config.dbPath)
    this.schemaManager = new SchemaManager(this.db)
    this.schemaManager.applyPragmas()

    // Override synchronous mode from config
    if (this.config.synchronousMode === 'FULL') {
      this.db.pragma('synchronous = FULL')
    }

    this.schemaManager.migrate()
    this.prepareStatements()
    this.startFlushTimer()
  }

  /* ─═ Public API ═─ */

  async append(envelope: Omit<EventEnvelope, 'sequence'>): Promise<EventEnvelope> {
    const start = performance.now()

    // Critical events bypass the buffer
    if (CRITICAL_EVENT_TYPES.has(envelope.type) && this.config.flushOnCritical) {
      // Flush any pending non-critical events first
      await this.flushBuffer()
      const result = this.insertImmediate(envelope)
      // Force WAL checkpoint for critical events
      this.db.pragma('wal_checkpoint(TRUNCATE)')
      this.lastFlushTime = performance.now()
      this._metrics.observeAppendLatency(performance.now() - start)
      this._metrics.incAppendTotal({ event_type: envelope.type, critical: 'true' })
      this.updateMetrics()
      return result
    }

    // Non-critical: buffer it
    this.buffer.push(envelope)
    this._metrics.incAppendTotal({ event_type: envelope.type, critical: 'false' })

    // Auto-flush if buffer is full
    if (this.buffer.length >= this.config.maxBufferedEvents) {
      await this.flushBuffer()
    }

    // Generate the sequence number for the response
    const seq = this.getCurrentSequence() + this.buffer.length + 1
    this._metrics.observeAppendLatency(performance.now() - start)
    this.updateMetrics()

    // Build a partial result envelope with estimated sequence
    return {
      ...envelope,
      sequence: seq,
    } as EventEnvelope
  }

  async flush(): Promise<void> {
    await this.flushBuffer()
    this.db.pragma('wal_checkpoint(PASSIVE)')
  }

  async rotate(): Promise<void> {
    // Future: close current file, open new segment
    await this.flush()
  }

  async recover(): Promise<JournalRecoveryResult> {
    const errors: string[] = []

    try {
      // Run integrity check
      const integrityRow = this.db.pragma('integrity_check') as Array<{ integrity_check: string }>
      const integrityOk = integrityRow.length === 1 && integrityRow[0].integrity_check === 'ok'
      if (!integrityOk) {
        errors.push(`Integrity check: ${JSON.stringify(integrityRow)}`)
      }

      // Verify schema version
      const sv = this.schemaManager.currentVersion
      if (sv === 0) {
        errors.push('Schema version is 0 — database not initialised')
      }

      // Count events
      const eventCount = (this.stmtCountEvents.get() as { cnt: number }).cnt

      // Get last sequence
      const lastSeq = this.getCurrentSequence()

      // WAL checkpoint
      this.db.pragma('wal_checkpoint(TRUNCATE)')

      return {
        ok: errors.length === 0,
        lastSequence: lastSeq,
        eventCount,
        errors,
      }
    } catch (err) {
      return {
        ok: false,
        lastSequence: 0,
        eventCount: 0,
        errors: [(err as Error).message],
      }
    }
  }

  async *read(filter?: JournalFilter): AsyncIterable<EventEnvelope> {
    const start = performance.now()
    const { sql, params } = this.buildFilterQuery(filter)
    const stmt = this.db.prepare(sql)

    for (const row of stmt.iterate(...params)) {
      yield this.rowToEnvelope(row as EventRow)
    }

    this._metrics.incReadTotal()
    this._metrics.observeReadLatency(performance.now() - start)
  }

  getCurrentSequence(): number {
    const row = this.stmtSequence.get() as { seq: number | null }
    return row.seq ?? 0
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true

    // Flush on shutdown
    if (this.config.flushOnShutdown) {
      await this.flushBuffer()
    }

    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    this.db.close()
  }

  /* ─═ Read API shortcuts ═─ */

  /** Read all events since a sequence number */
  async *readSince(sequence: number): AsyncIterable<EventEnvelope> {
    yield* this.read({ afterSequence: sequence })
  }

  /** Read all events by trace ID */
  async *readByTrace(traceId: string): AsyncIterable<EventEnvelope> {
    yield* this.read({ traceId })
  }

  /** Read all events for an aggregate */
  async *readAggregate(aggregateType: string, aggregateId: string): AsyncIterable<EventEnvelope> {
    const stmt = this.db.prepare(
      'SELECT * FROM events WHERE aggregate_type = ? AND aggregate_id = ? ORDER BY sequence ASC'
    )
    for (const row of stmt.iterate(aggregateType, aggregateId)) {
      yield this.rowToEnvelope(row as EventRow)
    }
  }

  /** Read all events for a runtime */
  async *readRuntime(runtimeId: string): AsyncIterable<EventEnvelope> {
    yield* this.read({ runtime: runtimeId as any })
  }

  /** Read the last N events */
  async *tail(n: number): AsyncIterable<EventEnvelope> {
    const stmt = this.db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?')
    const rows = stmt.all(n) as EventRow[]
    // Return in ascending order
    for (let i = rows.length - 1; i >= 0; i--) {
      yield this.rowToEnvelope(rows[i])
    }
  }

  /** Count events matching a filter */
  count(filter?: JournalFilter): number {
    const { sql, params } = this.buildCountQuery(filter)
    const row = this.db.prepare(sql).get(...params) as { cnt: number }
    return row.cnt
  }

  /* ─═ Atomic checkpoint: events + snapshot in one transaction ═─ */

  checkpoint(
    events: Omit<EventEnvelope, 'sequence'>[],
    snapshot: Omit<SnapshotRecord, 'last_applied_sequence'>,
  ): CheckpointResult {
    const start = performance.now()
    const appended: EventEnvelope[] = []

    this.db.transaction(() => {
      // 1. Append all events
      for (const env of events) {
        const seq = this.getCurrentSequence() + 1
        this.stmtInsertEvent.run(this.envelopeToRow(env, seq))
        appended.push({ ...env, sequence: seq } as EventEnvelope)
      }

      // 2. Save snapshot with last_applied_sequence = journal's current max
      const lastSeq = this.getCurrentSequence()
      this.stmtInsertSnapshot.run(
        snapshot.snapshot_id,
        snapshot.aggregate_id,
        snapshot.sequence,
        snapshot.snapshot_version ?? 1,
        snapshot.checksum ?? null,
        lastSeq, // last_applied_sequence = current journal tip
        snapshot.created_at,
        snapshot.payload,
      )
    })()

    this._metrics.incCheckpointTotal()
    this._metrics.observeAppendLatency(performance.now() - start)
    this.updateMetrics()

    return {
      events: appended,
      snapshotSequence: this.getCurrentSequence(),
    }
  }

  /* ─═ Snapshot storage ═─ */

  saveSnapshot(snapshot: SnapshotRecord): void {
    this.stmtInsertSnapshot.run(
      snapshot.snapshot_id,
      snapshot.aggregate_id,
      snapshot.sequence,
      snapshot.snapshot_version ?? 1,
      snapshot.checksum ?? null,
      snapshot.last_applied_sequence ?? null,
      snapshot.created_at,
      snapshot.payload,
    )
    this._metrics.setSnapshotsGauge(
      (this.stmtCountSnapshots.get() as { cnt: number }).cnt
    )
  }

  loadSnapshot(aggregateId: string): SnapshotRecord | null {
    const row = this.stmtSnapshotByAggregate.get(aggregateId) as SnapshotRow | undefined
    if (!row) return null
    return this.rowToSnapshot(row)
  }

  listAggregateIds(): string[] {
    const rows = this.db.prepare('SELECT DISTINCT aggregate_id FROM snapshots').all() as Array<{ aggregate_id: string }>
    return rows.map(r => r.aggregate_id)
  }

  pruneSnapshots(keepLast: number): number {
    const start = performance.now()
    const result = this.db.prepare(`
      DELETE FROM snapshots WHERE snapshot_id NOT IN (
        SELECT snapshot_id FROM snapshots
        ORDER BY created_at DESC
        LIMIT ?
      )
    `).run(Math.max(1, keepLast))
    this._metrics.incPruneTotal()
    this._metrics.observeFlushLatency(performance.now() - start)
    this.updateMetrics()
    return result.changes ?? 0
  }

  /** Cursor for replay: max last_applied_sequence across all snapshots */
  getLastAppliedSequence(): number {
    const row = this.stmtMaxApplied.get() as { seq: number | null }
    return row.seq ?? 0
  }

  /* ─═ Health ═─ */

  health(): JournalHealth {
    const pageCount = (this.db.pragma('page_count') as Array<{ page_count: number }>)[0]?.page_count ?? 0
    const pageSize = (this.db.pragma('page_size') as Array<{ page_size: number }>)[0]?.page_size ?? 4096
    const dbSizeMb = (pageCount * pageSize) / (1024 * 1024)

    const eventCount = (this.stmtCountEvents.get() as { cnt: number }).cnt
    const snapCount = (this.stmtCountSnapshots.get() as { cnt: number }).cnt

    let walAge = 0
    try {
      const walPages = this.db.pragma('wal_checkpoint(PASSIVE)') as unknown as number[]
      walAge = Array.isArray(walPages) && walPages.length >= 3 ? walPages[1] - walPages[2] : 0
    } catch { /* ignore */ }

    return {
      healthy: !this.closed,
      db_size_mb: Math.round(dbSizeMb * 100) / 100,
      events: eventCount,
      snapshots: snapCount,
      last_flush_ms: this.lastFlushTime,
      queue_depth: this.buffer.length,
      wal_checkpoint_age: Math.max(0, walAge),
      schema_version: this.schemaManager.currentVersion,
      last_applied_sequence: this.getLastAppliedSequence(),
    }
  }

  /** Access the metrics collector for wiring */
  get metrics(): JournalMetricsCollector {
    return this._metrics
  }

  set metrics(m: JournalMetricsCollector) {
    this._metrics = m
  }

  /* ─═ Internal helpers ═─ */

  private prepareStatements(): void {
    this.stmtInsertEvent = this.db.prepare(`
      INSERT INTO events (event_id, trace_id, causation_id, runtime_id, event_type,
                          aggregate_type, aggregate_id, sequence, timestamp, critical, payload, metadata)
      VALUES (@event_id, @trace_id, @causation_id, @runtime_id, @event_type,
              @aggregate_type, @aggregate_id, @sequence, @timestamp, @critical, @payload, @metadata)
    `)

    this.stmtInsertEventImmediate = this.db.prepare(`
      INSERT INTO events (event_id, trace_id, causation_id, runtime_id, event_type,
                          aggregate_type, aggregate_id, sequence, timestamp, critical, payload, metadata)
      VALUES (@event_id, @trace_id, @causation_id, @runtime_id, @event_type,
              @aggregate_type, @aggregate_id, @sequence, @timestamp, @critical, @payload, @metadata)
    `)

    this.stmtInsertSnapshot = this.db.prepare(`
      INSERT OR REPLACE INTO snapshots
        (snapshot_id, aggregate_id, sequence, snapshot_version, checksum, last_applied_sequence, created_at, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    this.stmtSequence = this.db.prepare('SELECT MAX(sequence) as seq FROM events')
    this.stmtCountEvents = this.db.prepare('SELECT COUNT(*) as cnt FROM events')
    this.stmtCountSnapshots = this.db.prepare('SELECT COUNT(*) as cnt FROM snapshots')
    this.stmtEventById = this.db.prepare('SELECT * FROM events WHERE event_id = ?')
    this.stmtSnapshotByAggregate = this.db.prepare(
      'SELECT * FROM snapshots WHERE aggregate_id = ? ORDER BY sequence DESC LIMIT 1'
    )
    this.stmtSnapshotById = this.db.prepare('SELECT * FROM snapshots WHERE snapshot_id = ?')
    this.stmtDeleteOldSnapshots = this.db.prepare(
      'DELETE FROM snapshots WHERE snapshot_id NOT IN (SELECT snapshot_id FROM snapshots ORDER BY sequence DESC LIMIT ?)'
    )
    this.stmtMaxApplied = this.db.prepare('SELECT MAX(last_applied_sequence) as seq FROM snapshots')
  }

  private startFlushTimer(): void {
    if (this.config.maxFlushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        if (this.buffer.length > 0) {
          this.flushBuffer().catch(() => {})
        }
      }, this.config.maxFlushIntervalMs)
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return

    const start = performance.now()
    const batch = this.buffer.splice(0, this.buffer.length)

    const tx = this.db.transaction((items: Omit<EventEnvelope, 'sequence'>[]) => {
      for (const env of items) {
        this.stmtInsertEvent.run(this.envelopeToRow(env, this.getCurrentSequence() + 1))
      }
    })

    try {
      tx(batch)
      this.lastFlushTime = performance.now()
      this._metrics.incFlushTotal()
      this._metrics.observeFlushLatency(performance.now() - start)
      this.updateMetrics()
    } catch (err) {
      // Put items back in buffer on failure
      this.buffer.unshift(...batch)
      this._metrics.incErrorsTotal()
      throw err
    }
  }

  private insertImmediate(envelope: Omit<EventEnvelope, 'sequence'>): EventEnvelope {
    const seq = this.getCurrentSequence() + 1
    this.db.transaction(() => {
      this.stmtInsertEventImmediate.run(this.envelopeToRow(envelope, seq))
    })()
    return { ...envelope, sequence: seq } as EventEnvelope
  }

  private envelopeToRow(env: Omit<EventEnvelope, 'sequence'>, seq: number) {
    return {
      event_id: env.id,
      trace_id: env.traceId ?? null,
      causation_id: env.causationId ?? null,
      runtime_id: env.runtime,
      event_type: env.type,
      aggregate_type: env.tradeId ? 'trade' : null,
      aggregate_id: env.tradeId ?? null,
      sequence: seq,
      timestamp: env.timestamp,
      critical: CRITICAL_EVENT_TYPES.has(env.type) ? 1 : 0,
      payload: JSON.stringify(env.payload),
      metadata: JSON.stringify(env.metadata),
    }
  }

  private rowToEnvelope(row: EventRow): EventEnvelope {
    let metadata: EventEnvelopeMetadata = { version: 1, schemaVersion: 1, source: 'unknown' }
    try {
      if (row.metadata) metadata = JSON.parse(row.metadata)
    } catch { /* use default */ }

    let payload: unknown = {}
    try {
      if (row.payload) payload = JSON.parse(row.payload)
    } catch { /* use default */ }

    return {
      id: row.event_id,
      traceId: row.trace_id ?? '',
      causationId: row.causation_id ?? undefined,
      runtime: row.runtime_id as any,
      type: row.event_type,
      sequence: row.sequence,
      timestamp: row.timestamp,
      payload,
      metadata,
      tradeId: row.aggregate_id ?? undefined,
    }
  }

  private rowToSnapshot(row: SnapshotRow): SnapshotRecord {
    return {
      snapshot_id: row.snapshot_id,
      aggregate_id: row.aggregate_id,
      sequence: row.sequence,
      snapshot_version: row.snapshot_version ?? 1,
      checksum: row.checksum ?? null,
      last_applied_sequence: row.last_applied_sequence ?? null,
      created_at: row.created_at,
      payload: row.payload ?? '{}',
    }
  }

  private buildFilterQuery(filter?: JournalFilter): { sql: string; params: unknown[] } {
    const conditions: string[] = ['1=1']
    const params: unknown[] = []

    if (!filter) return { sql: 'SELECT * FROM events WHERE 1=1 ORDER BY sequence ASC', params: [] }

    if (filter.runtime) {
      conditions.push('runtime_id = ?')
      params.push(filter.runtime)
    }
    if (filter.type) {
      if (Array.isArray(filter.type)) {
        conditions.push(`event_type IN (${filter.type.map(() => '?').join(',')})`)
        params.push(...filter.type)
      } else {
        conditions.push('event_type = ?')
        params.push(filter.type)
      }
    }
    if (filter.traceId) {
      conditions.push('trace_id = ?')
      params.push(filter.traceId)
    }
    if (filter.tradeId) {
      conditions.push('aggregate_id = ?')
      params.push(filter.tradeId)
    }
    if (filter.correlationId) {
      conditions.push('causation_id = ?')
      params.push(filter.correlationId)
    }
    if (filter.afterSequence) {
      conditions.push('sequence > ?')
      params.push(filter.afterSequence)
    }
    if (filter.beforeSequence) {
      conditions.push('sequence < ?')
      params.push(filter.beforeSequence)
    }
    if (filter.afterTimestamp) {
      conditions.push('timestamp >= ?')
      params.push(filter.afterTimestamp)
    }
    if (filter.beforeTimestamp) {
      conditions.push('timestamp <= ?')
      params.push(filter.beforeTimestamp)
    }

    let sql = `SELECT * FROM events WHERE ${conditions.join(' AND ')} ORDER BY sequence ASC`
    if (filter.limit && filter.limit > 0) {
      sql += ` LIMIT ${filter.limit}`
    }

    return { sql, params }
  }

  private buildCountQuery(filter?: JournalFilter): { sql: string; params: unknown[] } {
    const { sql, params } = this.buildFilterQuery(filter)
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as cnt').replace(/ ORDER BY .*$/, '')
    return { sql: countSql, params }
  }

  private updateMetrics(): void {
    this._metrics.setEventsGauge((this.stmtCountEvents.get() as { cnt: number }).cnt)
    this._metrics.setSnapshotsGauge((this.stmtCountSnapshots.get() as { cnt: number }).cnt)
    this._metrics.setQueueDepthGauge(this.buffer.length)
    const pageCount = (this.db.pragma('page_count') as Array<{ page_count: number }>)[0]?.page_count ?? 0
    const pageSize = (this.db.pragma('page_size') as Array<{ page_size: number }>)[0]?.page_size ?? 4096
    this._metrics.setDbSizeGauge((pageCount * pageSize) / (1024 * 1024))
  }
}
