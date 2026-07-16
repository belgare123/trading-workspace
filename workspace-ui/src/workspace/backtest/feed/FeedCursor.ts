// ── FeedCursor — Position tracking inside a feed ──
//
// @since 3.5.3

import type { StrategyBar } from '../../strategy/definition'

export class FeedCursor {
  private _position = 0
  private _bars: StrategyBar[] = []

  get position(): number {
    return this._position
  }

  get totalBars(): number {
    return this._bars.length
  }

  get hasNext(): boolean {
    return this._position < this._bars.length
  }

  /** Current bar (at cursor) */
  get current(): StrategyBar | undefined {
    return this._bars[this._position]
  }

  /** Peek at next bar without advancing */
  get next(): StrategyBar | undefined {
    return this._bars[this._position + 1]
  }

  /** Advance cursor and return bar */
  advance(): StrategyBar {
    if (!this.hasNext) throw new Error('No more bars in feed')
    return this._bars[this._position++]
  }

  /** Load new bar set */
  load(bars: StrategyBar[]): void {
    this._bars = bars
    this._position = 0
  }

  /** Reset to beginning */
  reset(): void {
    this._position = 0
  }

  /** Progress ratio 0–1 */
  get progress(): number {
    return this.totalBars === 0 ? 0 : this._position / this.totalBars
  }

  /** Progress percentage 0–100 */
  get percent(): number {
    return this.progress * 100
  }
}
