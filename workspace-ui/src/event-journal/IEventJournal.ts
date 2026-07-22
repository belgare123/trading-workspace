// src/event-journal/IEventJournal.ts — Interface for journal storage backends

import type { EventEnvelope } from './EventEnvelope'
import type { JournalFilter } from './types'

export interface JournalRecoveryResult {
  ok: boolean
  lastSequence: number
  eventCount: number
  errors: string[]
}

export interface SnapshotRecord {
  snapshot_id: string
  aggregate_id: string
  sequence: number
  snapshot_version: number
  checksum: string | null
  last_applied_sequence: number | null
  created_at: number
  payload: string
}

export interface CheckpointResult {
  events: EventEnvelope[]
  snapshotSequence: number
}

export interface IEventJournal {
  /** Append an event to the journal. Returns the complete envelope with sequence assigned. */
  append(envelope: Omit<EventEnvelope, 'sequence'>): Promise<EventEnvelope>

  /** Flush any buffered writes to durable storage. */
  flush(): Promise<void>

  /** Rotate to a new journal segment (future use). */
  rotate(): Promise<void>

  /** Recover — verify integrity and return metadata. */
  recover(): Promise<JournalRecoveryResult>

  /** Read events matching an optional filter. */
  read(filter?: JournalFilter): AsyncIterable<EventEnvelope>

  /** Get the current highest sequence number. */
  getCurrentSequence(): number

  /** Close the journal, releasing all resources. */
  close(): Promise<void>

  // ─── Snapshot methods ───

  /** Atomically append events AND save a snapshot in one transaction. */
  checkpoint(
    events: Omit<EventEnvelope, 'sequence'>[],
    snapshot: Omit<SnapshotRecord, 'last_applied_sequence'>,
  ): CheckpointResult

  /** Save a single snapshot (no atomicity with events). */
  saveSnapshot(snapshot: SnapshotRecord): void

  /** Load the latest snapshot for an aggregate. Returns null if none exists. */
  loadSnapshot(aggregateId: string): SnapshotRecord | null

  /** List all aggregate IDs that have snapshots. */
  listAggregateIds(): string[]

  /** Delete old snapshots, keeping only the most recent `keepLast` per aggregate. */
  pruneSnapshots(keepLast: number): number

  /** Get the cursor sequence for replay (max last_applied_sequence across snapshots). */
  getLastAppliedSequence(): number
}
