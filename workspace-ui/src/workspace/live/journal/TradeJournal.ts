/**
 * TradeJournal.ts — Records every trade decision and execution event
 *
 * Provides a searchable timeline of all actions:
 * - Order submission → acceptance/rejection
 * - Fills (partial/full)
 * - Position events (open, close, adjust)
 * - Cancellations, stop adjustments, take-profit fills
 *
 * Each journal entry is timestamped and tagged for traceability.
 *
 * @since 4.3
 */

export type JournalEntryType =
  | 'order:submitted'
  | 'order:accepted'
  | 'order:rejected'
  | 'order:filled'
  | 'order:partially_filled'
  | 'order:cancelled'
  | 'order:expired'
  | 'position:opened'
  | 'position:closed'
  | 'position:adjusted'
  | 'stop:moved'
  | 'take_profit:filled'
  | 'balance:updated'
  | 'error'
  | 'info'

export interface JournalEntry {
  id: string
  type: JournalEntryType
  timestamp: number
  symbol?: string
  orderId?: string
  strategyId?: string
  /** Human-readable summary */
  message: string
  /** Structured data attached to this entry */
  data?: Record<string, unknown>
}

export class TradeJournal {
  private entries: JournalEntry[] = []
  private readonly MAX_ENTRIES = 10_000

  /** Record a journal entry */
  record(entry: Omit<JournalEntry, 'id'>): JournalEntry {
    const full: JournalEntry = {
      ...entry,
      id: `j_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    }
    this.entries.push(full)
    if (this.entries.length > this.MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - this.MAX_ENTRIES)
    }
    return full
  }

  /** Convenience: record an order-related entry */
  recordOrder(type: JournalEntryType, orderId: string, symbol: string, strategyId: string, message: string, data?: Record<string, unknown>): JournalEntry {
    return this.record({ type, timestamp: Date.now(), symbol, orderId, strategyId, message, data })
  }

  /** Convenience: record a position event */
  recordPosition(type: JournalEntryType, symbol: string, strategyId: string, message: string, data?: Record<string, unknown>): JournalEntry {
    return this.record({ type, timestamp: Date.now(), symbol, strategyId, message, data })
  }

  /** Get all entries */
  getAll(): JournalEntry[] {
    return [...this.entries]
  }

  /** Get entries for a specific order */
  getByOrder(orderId: string): JournalEntry[] {
    return this.entries.filter(e => e.orderId === orderId)
  }

  /** Get entries for a specific symbol */
  getBySymbol(symbol: string): JournalEntry[] {
    return this.entries.filter(e => e.symbol?.toUpperCase() === symbol.toUpperCase())
  }

  /** Get entries of a specific type */
  getByType(type: JournalEntryType): JournalEntry[] {
    return this.entries.filter(e => e.type === type)
  }

  /** Get entries within a time range */
  getRange(from: number, to: number): JournalEntry[] {
    return this.entries.filter(e => e.timestamp >= from && e.timestamp <= to)
  }

  /** Get the most recent N entries */
  getRecent(n: number): JournalEntry[] {
    return this.entries.slice(-n)
  }

  /** Get all entries for a strategy */
  getByStrategy(strategyId: string): JournalEntry[] {
    return this.entries.filter(e => e.strategyId === strategyId)
  }

  /** Clear all entries */
  clear(): void {
    this.entries = []
  }

  /** Get entry count */
  get size(): number {
    return this.entries.length
  }
}
