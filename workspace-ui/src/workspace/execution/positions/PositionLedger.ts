// ── PositionLedger — Low-level position tracking ──
//
// Pure data container. No side effects — PositionRuntime handles events.
//
// @since 3.5.1

import type { Position, PositionDirection, Fill, Order } from '../types'

export class PositionLedger {
  private positions: Map<string, Position> = new Map()

  /** Get current position for a symbol */
  get(symbol: string): Position | undefined {
    return this.positions.get(symbol)
  }

  /** All current positions (non-flat) */
  all(): Position[] {
    return Array.from(this.positions.values()).filter(p => p.direction !== 'flat')
  }

  /** Process a fill and update the position */
  apply(fill: Fill, _order: Order): Position {
    const current = this.get(fill.symbol) ?? this.zeroPosition(fill.symbol)

    // Calculate new position
    const delta = fill.side === 'buy' ? fill.quantity : -fill.quantity
    const newQty = current.quantity + delta

    if (Math.abs(newQty) < 1e-12) {
      // Position closed
      const closed: Position = {
        ...current,
        direction: 'flat',
        quantity: 0,
        currentPrice: fill.price,
        realizedPnl: current.realizedPnl + this.calculatePnl(current, fill),
        updatedAt: Date.now(),
      }
      this.positions.set(fill.symbol, closed)
      return closed
    }

    const newDirection: PositionDirection = newQty > 0 ? 'long' : 'short'
    const absQty = Math.abs(newQty)
    const wasFlat = current.direction === 'flat'
    const isIncrease = newDirection === current.direction || wasFlat

    // Calculate new average entry price (only on position increase or open)
    let newAvgPrice: number
    let realizedPnl = current.realizedPnl

    if (isIncrease) {
      // Adding to position
      const totalCost = current.averageEntryPrice * current.quantity + fill.price * delta
      newAvgPrice = totalCost / newQty
    } else {
      // Reducing or reversing — realize PnL on the reducing leg
      realizedPnl += this.calculatePnl(current, fill)
      if (newDirection !== current.direction) {
        // Full reversal — the remaining new position starts at fill price
        newAvgPrice = fill.price
      } else {
        newAvgPrice = current.averageEntryPrice
      }
    }

    const position: Position = {
      symbol: fill.symbol,
      direction: newDirection,
      quantity: absQty,
      averageEntryPrice: newAvgPrice,
      currentPrice: fill.price,
      unrealizedPnl: 0,
      realizedPnl,
      openedAt: wasFlat ? Date.now() : current.openedAt,
      updatedAt: Date.now(),
    }
    this.positions.set(fill.symbol, position)
    return position
  }

  /** Update current price for all positions (mark-to-market) */
  markToMarket(symbol: string, price: number): Position | undefined {
    const pos = this.positions.get(symbol)
    if (!pos || pos.direction === 'flat') return undefined
    const unrealizedPnl = this.calculateUnrealized(pos, price)
    const updated: Position = { ...pos, currentPrice: price, unrealizedPnl, updatedAt: Date.now() }
    this.positions.set(symbol, updated)
    return updated
  }

  /** Calculate realized PnL from a fill against current position */
  private calculatePnl(current: Position, fill: Fill): number {
    if (current.direction === 'flat') return 0
    // Fill reduces the position -> realize PnL
    if ((current.direction === 'long' && fill.side === 'sell') ||
        (current.direction === 'short' && fill.side === 'buy')) {
      const reduceQty = Math.min(current.quantity, fill.quantity)
      return current.direction === 'long'
        ? (fill.price - current.averageEntryPrice) * reduceQty
        : (current.averageEntryPrice - fill.price) * reduceQty
    }
    return 0
  }

  private calculateUnrealized(pos: Position, currentPrice: number): number {
    if (pos.direction === 'flat') return 0
    return pos.direction === 'long'
      ? (currentPrice - pos.averageEntryPrice) * pos.quantity
      : (pos.averageEntryPrice - currentPrice) * pos.quantity
  }

  private zeroPosition(symbol: string): Position {
    return {
      symbol,
      direction: 'flat',
      quantity: 0,
      averageEntryPrice: 0,
      currentPrice: 0,
      unrealizedPnl: 0,
      realizedPnl: 0,
      openedAt: 0,
      updatedAt: 0,
    }
  }

  clear(): void {
    this.positions.clear()
  }
}
