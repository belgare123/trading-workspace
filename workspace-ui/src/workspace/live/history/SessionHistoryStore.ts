/**
 * SessionHistoryStore.ts — Per-session trading statistics
 *
 * Aggregates all trading activity into session-level metrics.
 * A session runs from strategy start to stop (or disconnect).
 *
 * @since 4.4
 */

import type { SessionRecord } from './types'

export class SessionHistoryStore {
  private sessions = new Map<string, SessionRecord>()
  private currentId: string | null = null
  private maxSessions: number

  constructor(maxSessions = 200) {
    this.maxSessions = maxSessions
  }

  /** Start a new session */
  beginSession(strategyId: string): SessionRecord {
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const record: SessionRecord = {
      sessionId: id,
      strategyId,
      startedAt: Date.now(),
      ordersPlaced: 0,
      ordersFilled: 0,
      ordersCancelled: 0,
      totalVolume: 0,
      totalCommission: 0,
      netPnl: 0,
      winRate: 0,
      positionsOpened: 0,
      positionsClosed: 0,
      peakEquity: 0,
      currentEquity: 0,
      maxDrawdown: 0,
      decisions: 0,
      signalsProcessed: 0,
    }
    this.sessions.set(id, record)
    this.currentId = id
    this.trim()
    return record
  }

  /** End the current session */
  endSession(): SessionRecord | undefined {
    if (!this.currentId) return undefined
    const record = this.sessions.get(this.currentId)
    if (!record) return undefined

    record.endedAt = Date.now()
    record.duration = record.endedAt - record.startedAt
    this.currentId = null
    return record
  }

  /** Get current (active) session */
  getCurrent(): SessionRecord | undefined {
    return this.currentId ? this.sessions.get(this.currentId) : undefined
  }

  /** Update metrics */
  recordOrderPlaced(): void {
    const s = this.getCurrent()
    if (s) s.ordersPlaced++
  }

  recordOrderFilled(volume: number, commission: number): void {
    const s = this.getCurrent()
    if (s) {
      s.ordersFilled++
      s.totalVolume += volume
      s.totalCommission += commission
    }
  }

  recordOrderCancelled(): void {
    const s = this.getCurrent()
    if (s) s.ordersCancelled++
  }

  recordPositionOpened(): void {
    const s = this.getCurrent()
    if (s) s.positionsOpened++
  }

  recordPositionClosed(pnl: number): void {
    const s = this.getCurrent()
    if (s) {
      s.positionsClosed++
      s.netPnl += pnl
      if (s.positionsClosed > 0) {
        s.winRate = (s.positionsClosed > 0 ? s.positionsClosed : 0) / s.positionsClosed
      }
    }
  }

  recordDecision(): void {
    const s = this.getCurrent()
    if (s) s.decisions++
  }

  recordSignal(): void {
    const s = this.getCurrent()
    if (s) s.signalsProcessed++
  }

  updateEquity(equity: number): void {
    const s = this.getCurrent()
    if (!s) return
    s.currentEquity = equity
    if (equity > s.peakEquity) s.peakEquity = equity
    if (s.peakEquity > 0) {
      const dd = (s.peakEquity - equity) / s.peakEquity
      if (dd > s.maxDrawdown) s.maxDrawdown = dd
    }
  }

  /** Get all sessions */
  all(): SessionRecord[] {
    return Array.from(this.sessions.values())
  }

  /** Get sessions for a strategy */
  getByStrategy(strategyId: string): SessionRecord[] {
    return Array.from(this.sessions.values()).filter(s => s.strategyId === strategyId)
  }

  get size(): number {
    return this.sessions.size
  }

  clear(): void {
    this.sessions.clear()
    this.currentId = null
  }

  private trim(): void {
    if (this.sessions.size <= this.maxSessions) return
    const sorted = Array.from(this.sessions.entries())
      .sort(([, a], [, b]) => a.startedAt - b.startedAt)
    const toRemove = sorted.slice(0, sorted.length - this.maxSessions)
    for (const [id] of toRemove) {
      this.sessions.delete(id)
    }
  }
}
