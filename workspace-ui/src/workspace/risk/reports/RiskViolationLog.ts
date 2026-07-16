/**
 * RiskViolationLog.ts — Persistent log of risk violations
 *
 * @since 4.7
 */

import type { RiskReportEntry } from '../types'

export class RiskViolationLog {
  private entries: RiskReportEntry[] = []
  private maxEntries: number

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries
  }

  log(entry: RiskReportEntry): void {
    this.entries.push(entry)
    if (this.entries.length > this.maxEntries) {
      this.entries.shift()
    }
  }

  /** Get recent violations, newest first */
  recent(count = 50): RiskReportEntry[] {
    return this.entries.slice(-count).reverse()
  }

  /** Get violations for a specific strategy */
  forStrategy(strategyId: string): RiskReportEntry[] {
    return this.entries.filter(e => e.strategyId === strategyId)
  }

  /** Get violations for a specific rule */
  forRule(ruleId: string): RiskReportEntry[] {
    return this.entries.filter(e => e.ruleId === ruleId)
  }

  /** Count of violations today */
  today(): string {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const startMs = startOfDay.getTime()
    return this.entries.filter(e => e.timestamp >= startMs).length.toString()
  }

  /** Total violation count */
  count(): number {
    return this.entries.length
  }

  /** Clear all entries */
  clear(): void {
    this.entries = []
  }

  /** Export all entries */
  export(): RiskReportEntry[] {
    return [...this.entries]
  }
}
