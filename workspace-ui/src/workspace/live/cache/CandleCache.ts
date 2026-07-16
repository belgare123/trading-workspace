/**
 * CandleCache.ts — In-memory cache of candlestick data
 *
 * Stores recent klines per symbol/interval pair.
 * Used by Chart Studio and StrategyRuntime.
 *
 * @since 4.2
 */

import type { KlineEvent, KlineInterval } from '../types'

export class CandleCache {
  private candles = new Map<string, KlineEvent[]>()
  private readonly MAX_CANDLES_PER_SYMBOL = 500

  private key(symbol: string, interval: KlineInterval): string {
    return `${symbol.toUpperCase()}:${interval}`
  }

  /** Add a kline event */
  push(event: KlineEvent): void {
    const k = this.key(event.symbol, event.interval)
    if (!this.candles.has(k)) {
      this.candles.set(k, [])
    }
    const arr = this.candles.get(k)!

    // Replace if same timestamp
    const existingIdx = arr.findIndex(c => c.timestamp === event.timestamp)
    if (existingIdx >= 0) {
      arr[existingIdx] = event
    } else {
      arr.push(event)
    }

    // Trim to max
    if (arr.length > this.MAX_CANDLES_PER_SYMBOL) {
      arr.splice(0, arr.length - this.MAX_CANDLES_PER_SYMBOL)
    }
  }

  /** Get candles for a symbol/interval */
  get(symbol: string, interval: KlineInterval, limit?: number): KlineEvent[] {
    const arr = this.candles.get(this.key(symbol, interval)) ?? []
    if (limit && limit < arr.length) {
      return arr.slice(-limit)
    }
    return [...arr]
  }

  /** Get the latest candle */
  latest(symbol: string, interval: KlineInterval): KlineEvent | undefined {
    const arr = this.candles.get(this.key(symbol, interval))
    return arr ? arr[arr.length - 1] : undefined
  }

  /** Get the last N candles */
  lastN(symbol: string, interval: KlineInterval, n: number): KlineEvent[] {
    return this.get(symbol, interval, n)
  }

  /** Clear all candles */
  clear(): void {
    this.candles.clear()
  }

  /** Clear candles for a specific symbol */
  clearSymbol(symbol: string): void {
    for (const key of this.candles.keys()) {
      if (key.startsWith(symbol.toUpperCase())) {
        this.candles.delete(key)
      }
    }
  }

  /** Get all symbol+interval keys */
  getKeys(): string[] {
    return Array.from(this.candles.keys())
  }
}
