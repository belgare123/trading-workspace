/**
 * OrderBookCache.ts — In-memory order book cache
 *
 * Maintains a local copy of the order book for each symbol.
 * Supports incremental updates from Binance depthUpdate streams.
 *
 * @since 4.2
 */

import type { OrderBookEvent, OrderBookLevel } from '../types'

export class OrderBookSnapshot {
  symbol: string
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  lastUpdateId: number
  timestamp: number

  constructor(
    symbol: string,
    bids: OrderBookLevel[],
    asks: OrderBookLevel[],
    lastUpdateId: number,
    timestamp: number,
  ) {
    this.symbol = symbol
    this.bids = bids
    this.asks = asks
    this.lastUpdateId = lastUpdateId
    this.timestamp = timestamp
  }

  /** Get best bid */
  get bestBid(): OrderBookLevel | undefined {
    return this.bids.length > 0 ? this.bids[0] : undefined
  }

  /** Get best ask */
  get bestAsk(): OrderBookLevel | undefined {
    return this.asks.length > 0 ? this.asks[0] : undefined
  }

  /** Get spread */
  get spread(): number | undefined {
    if (!this.bestBid || !this.bestAsk) return undefined
    return this.bestAsk.price - this.bestBid.price
  }

  /** Get mid price */
  get midPrice(): number | undefined {
    if (!this.bestBid || !this.bestAsk) return undefined
    return (this.bestBid.price + this.bestAsk.price) / 2
  }
}

export class OrderBookCache {
  private books = new Map<string, OrderBookSnapshot>()

  /** Update or replace the order book for a symbol */
  set(event: OrderBookEvent): void {
    this.books.set(
      event.symbol.toUpperCase(),
      new OrderBookSnapshot(
        event.symbol,
        event.bids.sort((a, b) => b.price - a.price),
        event.asks.sort((a, b) => a.price - b.price),
        event.lastUpdateId,
        event.timestamp,
      ),
    )
  }

  /** Apply an incremental depth update */
  applyUpdate(event: OrderBookEvent): void {
    const symbol = event.symbol.toUpperCase()
    let book = this.books.get(symbol)
    if (!book) {
      this.set(event)
      return
    }

    // Merge bids
    for (const bid of event.bids) {
      const idx = book.bids.findIndex(b => b.price === bid.price)
      if (bid.quantity === 0) {
        // Remove level
        if (idx >= 0) book.bids.splice(idx, 1)
      } else {
        if (idx >= 0) {
          book.bids[idx] = bid
        } else {
          book.bids.push(bid)
          book.bids.sort((a, b) => b.price - a.price)
        }
      }
    }

    // Merge asks
    for (const ask of event.asks) {
      const idx = book.asks.findIndex(a => a.price === ask.price)
      if (ask.quantity === 0) {
        if (idx >= 0) book.asks.splice(idx, 1)
      } else {
        if (idx >= 0) {
          book.asks[idx] = ask
        } else {
          book.asks.push(ask)
          book.asks.sort((a, b) => a.price - b.price)
        }
      }
    }

    book.lastUpdateId = event.lastUpdateId
    book.timestamp = event.timestamp
  }

  /** Get order book snapshot */
  get(symbol: string): OrderBookSnapshot | undefined {
    return this.books.get(symbol.toUpperCase())
  }

  /** Get bids for a symbol */
  getBids(symbol: string, depth?: number): OrderBookLevel[] {
    const book = this.books.get(symbol.toUpperCase())
    if (!book) return []
    return depth ? book.bids.slice(0, depth) : [...book.bids]
  }

  /** Get asks for a symbol */
  getAsks(symbol: string, depth?: number): OrderBookLevel[] {
    const book = this.books.get(symbol.toUpperCase())
    if (!book) return []
    return depth ? book.asks.slice(0, depth) : [...book.asks]
  }

  /** Get best bid and ask */
  getTop(symbol: string): { bid: OrderBookLevel | undefined; ask: OrderBookLevel | undefined } {
    const book = this.books.get(symbol.toUpperCase())
    return {
      bid: book?.bestBid,
      ask: book?.bestAsk,
    }
  }

  /** Get all symbols with order book data */
  getSymbols(): string[] {
    return Array.from(this.books.keys())
  }

  /** Clear all order books */
  clear(): void {
    this.books.clear()
  }

  /** Clear a specific symbol */
  clearSymbol(symbol: string): void {
    this.books.delete(symbol.toUpperCase())
  }
}
