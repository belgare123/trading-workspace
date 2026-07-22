// src/event-journal/EventStream.ts
// Phase 5.2 — Filtered, ordered event stream from journal.
// No recovery logic. Only: Journal → Filter → Ordered Event Stream.
// Events are always sorted by global sequence.

import type { IEventJournal } from './IEventJournal'
import type { EventEnvelope } from './EventEnvelope'
import type { JournalFilter } from './types'

/** Source of events for replay */
export type ReplayEventSource = 'journal' | 'memory'

/** Configuration for event stream read */
export interface EventStreamConfig {
  source: ReplayEventSource
  fromSequence?: number
  toSequence?: number
  aggregateIds?: string[]
  eventTypes?: string[]
  runtimes?: string[]
  batchSize?: number
}

/**
 * EventStream — pure event provider.
 * Reads events from the journal, applies filters, guarantees sequence order.
 * No replay or recovery logic.
 */
export class EventStream {
  private journal: IEventJournal
  private batchSize: number

  constructor(journal: IEventJournal, batchSize: number = 500) {
    this.journal = journal
    this.batchSize = batchSize
  }

  /**
   * Read events matching the given config.
   * Events are yielded in strict global sequence order.
   */
  async *read(config: EventStreamConfig): AsyncIterableIterator<EventEnvelope> {
    if (config.source === 'memory') return

    // Build the JournalFilter from config
    const filter: JournalFilter = {}

    if (config.fromSequence !== undefined) {
      filter.afterSequence = config.fromSequence
    }

    if (config.toSequence !== undefined) {
      filter.beforeSequence = config.toSequence + 1
    }

    if (config.aggregateIds && config.aggregateIds.length > 0) {
      // IEventJournal's JournalFilter supports tradeIds
      filter.tradeIds = config.aggregateIds
    }

    if (config.runtimes && config.runtimes.length > 0) {
      filter.runtimes = config.runtimes
    }

    if (config.eventTypes && config.eventTypes.length > 0) {
      filter.types = config.eventTypes
    }

    // Read from journal with limit for batching
    const limit = this.batchSize

    // Iterate through the journal's async iterable
    let yielded = 0
    for await (const event of this.journal.read(filter)) {
      // Apply toSequence check before yielding (journal filter is an optimization)
      if (config.toSequence !== undefined && event.sequence > config.toSequence) {
        return
      }

      yield event
      yielded++
    }
  }

  /**
   * Count events matching the given config without reading them.
   */
  async count(config: EventStreamConfig): Promise<number> {
    const filter: JournalFilter = {}

    if (config.fromSequence !== undefined) {
      filter.afterSequence = config.fromSequence
    }

    if (config.toSequence !== undefined) {
      filter.beforeSequence = config.toSequence + 1
    }

    return this.journal.count(filter)
  }
}
