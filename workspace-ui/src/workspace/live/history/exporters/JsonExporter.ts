/**
 * JsonExporter.ts — Export history data as JSON
 *
 * @since 4.4
 */

import type { OrderHistoryEntry, PositionHistoryEntry, DecisionRecord, SessionRecord, TimelineEntry } from '../types'
import type { JournalEntry } from '../../journal/TradeJournal'

export interface HistoryExport {
  exportedAt: number
  version: string
  orders?: OrderHistoryEntry[]
  positions?: PositionHistoryEntry[]
  decisions?: DecisionRecord[]
  sessions?: SessionRecord[]
  timeline?: TimelineEntry[]
  journal?: JournalEntry[]
}

export class JsonExporter {
  /** Export all data to a JSON object */
  export(params: {
    orders?: OrderHistoryEntry[]
    positions?: PositionHistoryEntry[]
    decisions?: DecisionRecord[]
    sessions?: SessionRecord[]
    timeline?: TimelineEntry[]
    journal?: JournalEntry[]
  }): HistoryExport {
    return {
      exportedAt: Date.now(),
      version: '1.0',
      ...params,
    }
  }

  /** Export as formatted JSON string */
  toJson(params: HistoryExport): string {
    return JSON.stringify(params, null, 2)
  }

  /** Export as compact JSON string */
  toJsonCompact(params: HistoryExport): string {
    return JSON.stringify(params)
  }
}
