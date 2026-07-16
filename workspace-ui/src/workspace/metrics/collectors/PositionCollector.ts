// ── PositionCollector — Collects positions from ExecutionEventBus ──
//
// Listens to POSITION_OPENED / UPDATED / CLOSED events.
// Tracks position history and state.
//
// @since 3.5.2

import type { Position, Collector, EventBusHandle, PositionEventData } from '../types'

export class PositionCollector implements Collector {
  readonly id = 'position-collector'
  private _positions: Map<string, Position> = new Map()
  private _events: PositionEventData[] = []
  private unsubs: (() => void)[] = []

  connect(bus: EventBusHandle): void {
    this.unsubs.push(
      bus.on('POSITION_OPENED', event => {
        this._positions.set(event.position.symbol, event.position)
        this._events.push({
          timestamp: event.timestamp,
          symbol: event.position.symbol,
          direction: event.position.direction,
          quantity: event.position.quantity,
          entryPrice: event.position.averageEntryPrice,
          type: 'OPENED',
        })
      }),
      bus.on('POSITION_UPDATED', event => {
        this._positions.set(event.position.symbol, event.position)
        this._events.push({
          timestamp: event.timestamp,
          symbol: event.position.symbol,
          direction: event.position.direction,
          quantity: event.position.quantity,
          entryPrice: event.position.averageEntryPrice,
          type: 'UPDATED',
        })
      }),
      bus.on('POSITION_CLOSED', event => {
        this._positions.delete(event.position.symbol)
        this._events.push({
          timestamp: event.timestamp,
          symbol: event.position.symbol,
          direction: 'flat',
          quantity: 0,
          entryPrice: 0,
          type: 'CLOSED',
        })
      }),
    )
  }

  get positions(): Position[] {
    return Array.from(this._positions.values())
  }

  /** Get position for a symbol */
  getPosition(symbol: string): Position | undefined {
    return this._positions.get(symbol)
  }

  /** All position events in chronological order */
  get events(): PositionEventData[] {
    return [...this._events]
  }

  /** Number of distinct positions ever opened */
  get totalOpened(): number {
    return this._events.filter(e => e.type === 'OPENED').length
  }

  get totalClosed(): number {
    return this._events.filter(e => e.type === 'CLOSED').length
  }

  /** Number of currently open positions */
  get openCount(): number {
    return this._positions.size
  }

  /** Total position exposure (sum of notional values) */
  get totalExposure(): number {
    return Array.from(this._positions.values()).reduce(
      (s, p) => s + p.quantity * p.currentPrice,
      0,
    )
  }

  reset(): void {
    this._positions.clear()
    this._events = []
    for (const unsub of this.unsubs) unsub()
    this.unsubs = []
  }
}
