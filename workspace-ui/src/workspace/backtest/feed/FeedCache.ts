// ── FeedCache — In-memory caching layer for feed bars ──
//
// @since 3.5.3

import type { StrategyBar } from '../../strategy/definition'

export class FeedCache {
  private _bars: StrategyBar[] = []
  private _chunkSize = 5000

  /** Store bars */
  load(bars: StrategyBar[]): void {
    this._bars = bars
  }

  /** Append additional bars */
  append(bars: StrategyBar[]): void {
    this._bars.push(...bars)
  }

  /** Get bar at index */
  get(index: number): StrategyBar | undefined {
    return this._bars[index]
  }

  /** Get a slice of bars */
  slice(start: number, end: number): StrategyBar[] {
    return this._bars.slice(start, end)
  }

  /** Get a window of bars ending at index (inclusive) */
  window(end: number, lookback: number): StrategyBar[] {
    const start = Math.max(0, end - lookback + 1)
    return this._bars.slice(start, end + 1)
  }

  get size(): number {
    return this._bars.length
  }

  get chunkSize(): number {
    return this._chunkSize
  }

  setChunkSize(size: number): void {
    this._chunkSize = size
  }

  /** Clear cache */
  clear(): void {
    this._bars = []
  }
}
