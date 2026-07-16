/**
 * TradeCache.ts — In-memory cache of recent trades
 *
 * Stores the most recent trades per symbol.
 *
 * @since 4.2
 */

import type { TradeEvent } from '../types'

export class TradeCache {
  private trades = new Map<string, TradeEvent[]>()
  private readonly MAX_TRADES_PER_SYMBOL = 200

  /** Add a trade */
  push(event: TradeEvent): void {
    const symbol = event.symbol.toUpperCase()
    if (!this.trades.has(symbol)) {
      this.trades.set(symbol, [])
    }
    const arr = this.trades.get(symbol)!
    arr.push(event)
    if (arr.length > this.MAX_TRADES_PER_SYMBOL) {
      arr.shift()
    }
  }

  /** Push multiple trades */
  pushMany(events: TradeEvent[]): void {
    for (const event of events) {
      this.push(event)
    }
  }

  /** Get recent trades for a symbol */
  get(symbol: string, limit?: number): TradeEvent[] {
    const arr = this.trades.get(symbol.toUpperCase()) ?? []
    if (limit && limit < arr.length) {
      return arr.slice(-limit)
    }
    return [...arr]
  }

  /** Get the most recent trade */
  latest(symbol: string): TradeEvent | undefined {
    const arr = this.trades.get(symbol.toUpperCase())
    return arr ? arr[arr.length - 1] : undefined
  }

  /** Clear all trades */
  clear(): void {
    this.trades.clear()
  }

  /** Clear trades for a specific symbol */
  clearSymbol(symbol: string): void {
    this.trades.delete(symbol.toUpperCase())
  }
}
