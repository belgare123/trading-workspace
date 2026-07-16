// ── PositionRuntime — High-level position management ──
//
// Uses PositionLedger internally. Emits events through provided callback.
//
// @since 3.5.1

import type { Position, Fill, Order } from '../types'
import { PositionLedger } from './PositionLedger'

export type PositionEventCallback = (event: {
  type: 'OPENED' | 'UPDATED' | 'CLOSED'
  position: Position
  previousPosition?: Position
}) => void

export class PositionRuntime {
  private ledger = new PositionLedger()
  private onEvent: PositionEventCallback | null = null

  setEventCallback(cb: PositionEventCallback): void {
    this.onEvent = cb
  }

  /** Process a fill and update positions */
  applyFill(fill: Fill, order: Order): Position {
    const prev = this.ledger.get(fill.symbol)
    const updated = this.ledger.apply(fill, order)
    this.emitChange(updated, prev)
    return updated
  }

  /** Mark positions to current market price */
  markToMarket(symbol: string, price: number): Position | undefined {
    return this.ledger.markToMarket(symbol, price)
  }

  /** Current positions */
  getPositions(): Position[] {
    return this.ledger.all()
  }

  /** Position for a symbol */
  getPosition(symbol: string): Position | undefined {
    return this.ledger.get(symbol)
  }

  /** Is position non-flat */
  hasPosition(symbol: string): boolean {
    const pos = this.ledger.get(symbol)
    return pos != null && pos.direction !== 'flat'
  }

  /** Net exposure (long + short) */
  getNetExposure(): number {
    return this.ledger.all().reduce((sum, p) => {
      return sum + (p.direction === 'long' ? p.quantity : -p.quantity)
    }, 0)
  }

  clear(): void {
    this.ledger.clear()
  }

  private emitChange(position: Position, previous?: Position): void {
    if (!this.onEvent) return
    if (previous && previous.direction !== 'flat' && position.direction === 'flat') {
      this.onEvent({ type: 'CLOSED', position, previousPosition: previous })
    } else if (!previous || previous.direction === 'flat') {
      this.onEvent({ type: 'OPENED', position })
    } else {
      this.onEvent({ type: 'UPDATED', position, previousPosition: previous })
    }
  }
}
