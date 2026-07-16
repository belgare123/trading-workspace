/**
 * TimelineBuilder.ts — Unified chronological view across all domains
 *
 * Aggregates entries from TradeJournal, OrderHistory, PositionHistory,
 * DecisionLog, and StrategyHistory into a single timeline.
 *
 * Every entry has a category, timestamp, label, detail, and reference.
 *
 * This is what the user sees when they ask "what happened and in what order."
 *
 * @since 4.4
 */

import type { TimelineEntry, TimelineCategory } from './types'

export interface TimelineSource {
  entries: TimelineEntry[]
}

export class TimelineBuilder {
  private entries: TimelineEntry[] = []
  private maxEntries: number

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries
  }

  /** Add a single timeline entry */
  add(entry: Omit<TimelineEntry, 'id'>): TimelineEntry {
    const full: TimelineEntry = {
      ...entry,
      id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    }
    this.entries.push(full)
    this.trim()
    return full
  }

  /** Batch-add from sources */
  addFrom(entries: TimelineEntry[]): void {
    // Assign IDs to any entries missing them
    for (const entry of entries) {
      if (!entry.id) {
        (entry as TimelineEntry).id = `tl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      }
    }
    this.entries.push(...entries)
    this.trim()
  }

  /** Convenience: add a simple event */
  event(category: TimelineCategory, label: string, detail: string, refId?: string, symbol?: string, strategyId?: string): TimelineEntry {
    return this.add({ timestamp: Date.now(), category, label, detail, refId, symbol, strategyId })
  }

  // ── Queries ──

  /** Get timeline sorted chronologically */
  getTimeline(from?: number, to?: number): TimelineEntry[] {
    let result = [...this.entries]
    if (from) result = result.filter(e => e.timestamp >= from)
    if (to) result = result.filter(e => e.timestamp <= to)
    return result.sort((a, b) => a.timestamp - b.timestamp)
  }

  /** Get timeline in reverse (newest first) */
  getRecent(n = 100): TimelineEntry[] {
    return this.entries.slice(-n).reverse()
  }

  /** Get entries of a specific category */
  getByCategory(category: TimelineCategory): TimelineEntry[] {
    return this.entries.filter(e => e.category === category)
  }

  /** Get entries for a symbol */
  getBySymbol(symbol: string): TimelineEntry[] {
    return this.entries.filter(e => e.symbol === symbol)
  }

  /** Get entries for a strategy */
  getByStrategy(strategyId: string): TimelineEntry[] {
    return this.entries.filter(e => e.strategyId === strategyId)
  }

  /** Get entries referencing a specific entity */
  getByRefId(refId: string): TimelineEntry[] {
    return this.entries.filter(e => e.refId === refId)
  }

  /** Get entries within a time range */
  getRange(from: number, to: number): TimelineEntry[] {
    return this.getTimeline(from, to)
  }

  /** Render timeline for display */
  render(n = 50): string {
    return this.getRecent(n).map(e => {
      const ts = new Date(e.timestamp).toLocaleTimeString('ru-RU', { hour12: false })
      return `${ts} [${e.category}] ${e.label}: ${e.detail}`
    }).join('\n')
  }

  get size(): number {
    return this.entries.length
  }

  clear(): void {
    this.entries = []
  }

  private trim(): void {
    if (this.entries.length <= this.maxEntries) return
    // Remove oldest first
    this.entries.splice(0, this.entries.length - this.maxEntries)
  }
}
