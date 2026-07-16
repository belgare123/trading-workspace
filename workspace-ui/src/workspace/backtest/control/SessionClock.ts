// ── SessionClock — Virtual time tracker for backtest sessions ──
//
// @since 3.5.3

import type { SessionClock as IClock } from '../types'

export class SessionClock implements IClock {
  private _startTime = 0
  private _firstTimestamp: number | null = null
  private _now = 0
  private _count = 0

  /** Current virtual timestamp */
  get now(): number {
    return this._now
  }

  /** Elapsed virtual time (ms between first and current) */
  get elapsed(): number {
    if (this._firstTimestamp === null) return 0
    return this._now - this._firstTimestamp
  }

  /** Real start time */
  get startTime(): number {
    return this._startTime
  }

  /** Initialize clock on first tick */
  tick(barTimestamp: number): void {
    if (this._firstTimestamp === null) {
      this._firstTimestamp = barTimestamp
      this._startTime = Date.now()
    }
    this._now = barTimestamp
    this._count++
  }

  /** Total bars processed */
  get count(): number {
    return this._count
  }

  /** Reset clock */
  reset(): void {
    this._startTime = 0
    this._firstTimestamp = null
    this._now = 0
    this._count = 0
  }
}
