// ── FeedWindow — Sliding window of bars for strategy context ──
//
// Provides the historical context (lookback) that strategies need.
//
// @since 3.5.3

import type { StrategyBar } from '../../strategy/definition'

export class FeedWindow {
  private _bars: StrategyBar[] = []
  private _maxSize: number

  constructor(maxSize: number = 500) {
    this._maxSize = maxSize
  }

  /** Push a new bar into the window */
  push(bar: StrategyBar): void {
    this._bars.push(bar)
    if (this._bars.length > this._maxSize) {
      this._bars.shift()
    }
  }

  /** All bars in window (chronological) */
  get bars(): StrategyBar[] {
    return [...this._bars]
  }

  /** Current (latest) bar */
  get current(): StrategyBar | undefined {
    return this._bars[this._bars.length - 1]
  }

  /** Previous bar */
  get previous(): StrategyBar | undefined {
    return this._bars[this._bars.length - 2]
  }

  /** Number of bars in window */
  get size(): number {
    return this._bars.length
  }

  /** Maximum window size */
  get maxSize(): number {
    return this._maxSize
  }

  /** Set new max size (trims if needed) */
  setMaxSize(size: number): void {
    this._maxSize = size
    while (this._bars.length > this._maxSize) {
      this._bars.shift()
    }
  }

  /** Get bar at offset from current (0 = current, 1 = previous) */
  lookback(offset: number): StrategyBar | undefined {
    return this._bars[this._bars.length - 1 - offset]
  }

  /** Check if we have enough bars */
  hasBars(count: number): boolean {
    return this._bars.length >= count
  }

  /** Clear window */
  clear(): void {
    this._bars = []
  }
}
