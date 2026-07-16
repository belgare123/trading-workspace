// ── HistoricalFeed — Provides market data from a list of bars ──
//
// Implements the BacktestFeed interface.
// Converts StrategyBar → MarketSnapshot for the execution engine.
//
// @since 3.5.3

import type { StrategyBar } from '../../strategy/definition'
import type { MarketSnapshot } from '../../execution/types'
import type { BacktestFeed } from '../types'
import { FeedCursor } from './FeedCursor'
import { FeedCache } from './FeedCache'
import { FeedWindow } from './FeedWindow'

export class HistoricalFeed implements BacktestFeed {
  readonly cursor: FeedCursor
  readonly cache: FeedCache
  readonly window: FeedWindow
  readonly symbol: string
  readonly timeframe: string

  constructor(symbol: string, timeframe: string, bars: StrategyBar[]) {
    this.symbol = symbol
    this.timeframe = timeframe
    this.cursor = new FeedCursor()
    this.cache = new FeedCache()
    this.window = new FeedWindow(500)

    this.cache.load(bars)
    this.cursor.load(bars)
  }

  get totalBars(): number {
    return this.cursor.totalBars
  }

  get position(): number {
    return this.cursor.position
  }

  get progress(): number {
    return this.cursor.progress
  }

  hasNext(): boolean {
    return this.cursor.hasNext
  }

  /** Peek at next bar without advancing */
  peek(): StrategyBar | null {
    return this.cursor.next ?? null
  }

  /** Advance and return a MarketSnapshot */
  next(spread: number): MarketSnapshot {
    const bar = this.cursor.advance()
    this.window.push(bar)

    const halfSpread = spread / 2
    return {
      symbol: this.symbol,
      bid: bar.close * (1 - halfSpread),
      ask: bar.close * (1 + halfSpread),
      last: bar.close,
      volume: bar.volume,
      timestamp: bar.timestamp,
      bar: {
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      },
    }
  }

  /** Reset to beginning */
  reset(): void {
    this.cursor.reset()
    this.window.clear()
  }

  /** Provide strategy bars for the current position */
  get history(): StrategyBar[] {
    return this.window.bars
  }

  /** Current bar (before advancing) */
  get current(): StrategyBar | undefined {
    return this.cursor.current
  }
}
