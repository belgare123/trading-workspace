/**
 * PositionHistoryStore.ts — Full position lifecycle tracking
 *
 * Records every event in a position's life: open, scale in/out,
 * stop/take-profit adjustments, and close.
 *
 * @since 4.4
 */

import type { PositionHistoryEntry, PositionEventType, PositionEvent } from './types'

export class PositionHistoryStore {
  private positions = new Map<string, PositionHistoryEntry>()
  private symbolPositions = new Map<string, string[]>() // symbol → positionIds
  private maxEntries: number

  constructor(maxEntries = 2_000) {
    this.maxEntries = maxEntries
  }

  /** Record position opened */
  open(symbol: string, strategyId: string, direction: 'long' | 'short', price: number, quantity: number, timestamp: number): PositionHistoryEntry {
    const id = `pos_${symbol}_${timestamp}_${Math.random().toString(36).slice(2, 6)}`
    const entry: PositionHistoryEntry = {
      positionId: id,
      strategyId,
      symbol,
      direction,
      openedAt: timestamp,
      openPrice: price,
      initialQuantity: quantity,
      events: [{
        type: 'opened',
        timestamp,
        price,
        quantity,
        message: `Opened ${direction} ${quantity} ${symbol} @ ${price}`,
      }],
    }

    this.positions.set(id, entry)
    const existing = this.symbolPositions.get(symbol) ?? []
    existing.push(id)
    this.symbolPositions.set(symbol, existing)
    this.trim()
    return entry
  }

  /** Record a position event (scale in/out, SL/TP move, close) */
  recordEvent(positionId: string, type: PositionEventType, price: number, quantity?: number, pnl?: number, message?: string): PositionHistoryEntry | undefined {
    const entry = this.positions.get(positionId)
    if (!entry) return undefined

    const event: PositionEvent = { type, timestamp: Date.now(), price, quantity, pnl, message }
    entry.events.push(event)

    if (type === 'closed') {
      entry.closedAt = event.timestamp
      entry.closePrice = price
      if (pnl != null) entry.realizedPnl = pnl
    }

    return entry
  }

  /** Close a position (find by symbol + strategy) */
  close(symbol: string, strategyId: string, closePrice: number, pnl: number, timestamp: number): PositionHistoryEntry | undefined {
    // Find the most recent open position for this symbol + strategy
    const ids = this.symbolPositions.get(symbol) ?? []
    const openEntries = ids
      .map(id => this.positions.get(id)!)
      .filter(p => p.strategyId === strategyId && !p.closedAt)
      .sort((a, b) => b.openedAt - a.openedAt)

    if (openEntries.length === 0) return undefined

    const entry = openEntries[0]
    entry.closedAt = timestamp
    entry.closePrice = closePrice
    entry.realizedPnl = pnl

    if (entry.openPrice > 0) {
      entry.pnlPercent = (closePrice - entry.openPrice) / entry.openPrice * 100 * (entry.direction === 'long' ? 1 : -1)
    }
    if (entry.openedAt) {
      entry.duration = timestamp - entry.openedAt
    }

    entry.events.push({
      type: 'closed',
      timestamp,
      price: closePrice,
      pnl,
      message: `Closed ${entry.direction} ${entry.symbol} @ ${closePrice} — PnL: ${pnl.toFixed(2)}`,
    })

    return entry
  }

  /** Get position by ID */
  get(positionId: string): PositionHistoryEntry | undefined {
    return this.positions.get(positionId)
  }

  /** Get all positions for a symbol */
  getBySymbol(symbol: string): PositionHistoryEntry[] {
    const ids = this.symbolPositions.get(symbol) ?? []
    return ids.map(id => this.positions.get(id)!).filter(Boolean)
  }

  /** Get all positions for a strategy */
  getByStrategy(strategyId: string): PositionHistoryEntry[] {
    return Array.from(this.positions.values()).filter(p => p.strategyId === strategyId)
  }

  /** Get open positions */
  getOpen(): PositionHistoryEntry[] {
    return Array.from(this.positions.values()).filter(p => !p.closedAt)
  }

  /** Get closed positions */
  getClosed(): PositionHistoryEntry[] {
    return Array.from(this.positions.values()).filter(p => p.closedAt != null)
  }

  /** All entries */
  all(): PositionHistoryEntry[] {
    return Array.from(this.positions.values())
  }

  /** Count */
  get size(): number {
    return this.positions.size
  }

  clear(): void {
    this.positions.clear()
    this.symbolPositions.clear()
  }

  private trim(): void {
    if (this.positions.size <= this.maxEntries) return
    const sorted = Array.from(this.positions.entries())
      .sort(([, a], [, b]) => a.openedAt - b.openedAt)
    const toRemove = sorted.slice(0, sorted.length - this.maxEntries)
    for (const [id] of toRemove) {
      this.positions.delete(id)
      // Clean symbol index
      for (const [sym, ids] of this.symbolPositions.entries()) {
        const filtered = ids.filter(i => i !== id)
        if (filtered.length === 0) this.symbolPositions.delete(sym)
        else this.symbolPositions.set(sym, filtered)
      }
    }
  }
}
