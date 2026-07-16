/**
 * TickerCache.ts — In-memory cache of latest ticker data
 *
 * Stores the most recent ticker snapshot per symbol.
 *
 * @since 4.2
 */

import type { TickerEvent } from '../types'

export class TickerCache {
  private tickers = new Map<string, TickerEvent>()

  /** Update ticker for a symbol */
  set(event: TickerEvent): void {
    this.tickers.set(event.symbol.toUpperCase(), event)
  }

  /** Get ticker for a symbol */
  get(symbol: string): TickerEvent | undefined {
    return this.tickers.get(symbol.toUpperCase())
  }

  /** Get price for a symbol (convenience) */
  getPrice(symbol: string): number | undefined {
    return this.tickers.get(symbol.toUpperCase())?.price
  }

  /** Check if a symbol has ticker data */
  has(symbol: string): boolean {
    return this.tickers.has(symbol.toUpperCase())
  }

  /** Get all tickers */
  getAll(): TickerEvent[] {
    return Array.from(this.tickers.values())
  }

  /** Get all symbols with ticker data */
  getSymbols(): string[] {
    return Array.from(this.tickers.keys())
  }

  /** Clear all tickers */
  clear(): void {
    this.tickers.clear()
  }
}
