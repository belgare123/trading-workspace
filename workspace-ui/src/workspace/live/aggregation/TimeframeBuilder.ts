/**
 * TimeframeBuilder.ts — Builds a single kline timeframe from trade data
 *
 * Maintains a running candle that updates with each trade event.
 * When the kline period ends, it emits the completed candle and starts a new one.
 *
 * @since 4.2
 */

import type { TradeEvent, KlineEvent, KlineInterval } from '../types'

const INTERVAL_MS: Record<KlineInterval, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
  '1M': 2_592_000_000,
}

export class TimeframeBuilder {
  readonly symbol: string
  readonly interval: KlineInterval

  private _current: KlineEvent | null = null
  private periodStart = 0
  private periodEnd = 0

  constructor(symbol: string, interval: KlineInterval) {
    this.symbol = symbol
    this.interval = interval
  }

  /** Get the current (incomplete) kline */
  get current(): KlineEvent | undefined {
    return this._current ?? undefined
  }

  /** Add a trade event. Returns completed kline if period ended. */
  addTrade(trade: TradeEvent): KlineEvent | null {
    if (this._current === null) {
      this.startNewPeriod(trade)
      return null
    }

    // Check if trade belongs to current period
    if (trade.timestamp >= this.periodEnd) {
      // Current period closed, emit it
      const completed = this.closeCurrent()
      // Start new period with this trade
      this.startNewPeriod(trade)
      return completed
    }

    // Update current candle
    this.updateCandle(trade)
    return null
  }

  /** Force close the current kline */
  closeCurrent(): KlineEvent | null {
    if (!this._current) return null
    const candle = this._current
    candle.closed = true
    this._current = null
    return candle
  }

  /** Reset the builder */
  reset(): void {
    this._current = null
    this.periodStart = 0
    this.periodEnd = 0
  }

  // ── Private ──

  private startNewPeriod(trade: TradeEvent): void {
    const ms = INTERVAL_MS[this.interval]
    const remainder = trade.timestamp % ms
    this.periodStart = trade.timestamp - remainder
    this.periodEnd = this.periodStart + ms

    this._current = {
      symbol: this.symbol,
      interval: this.interval,
      open: trade.price,
      high: trade.price,
      low: trade.price,
      close: trade.price,
      volume: trade.quantity,
      timestamp: this.periodStart,
      closed: false,
    }
  }

  private updateCandle(trade: TradeEvent): void {
    if (!this._current) return
    this._current.high = Math.max(this._current.high, trade.price)
    this._current.low = Math.min(this._current.low, trade.price)
    this._current.close = trade.price
    this._current.volume += trade.quantity
  }
}
