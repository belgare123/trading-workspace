/**
 * PositionSynchronizer.ts — Local ↔ broker position synchronization
 *
 * Periodically polls broker positions via PositionAdapter and emits
 * POSITION_OPENED / POSITION_UPDATED / POSITION_CLOSED events.
 *
 * Two sources of truth:
 *   1. Push — subscribePositions() for real-time updates
 *   2. Pull — periodic REST polling for reconciliation
 *
 * @since 4.5
 */

import type { BrokerAdapter, PositionAdapter } from './BrokerAdapter'
import type { BrokerPosition } from './types'
import type { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'
import type { Position } from '../../execution/types'

export class PositionSynchronizer {
  private adapter: PositionAdapter
  private eventBus?: ExecutionEventBus
  private timer: ReturnType<typeof setInterval> | null = null
  private lastPositions = new Map<string, BrokerPosition>() // key: symbol
  private unsubscribers: Array<() => void> = []

  constructor(adapter: BrokerAdapter) {
    this.adapter = adapter.positions
  }

  connectEventBus(bus: ExecutionEventBus): void {
    this.eventBus = bus

    // Subscribe to real-time push updates
    this.unsubscribers.push(
      this.adapter.subscribePositions((pos) => {
        this.handlePositionUpdate(pos)
      })
    )
  }

  /** Start periodic reconciliation */
  start(intervalMs = 5_000): void {
    if (this.timer) return
    this.timer = setInterval(() => this.sync(), intervalMs)
  }

  /** Stop periodic sync */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** One-shot reconciliation via REST */
  async sync(): Promise<void> {
    try {
      const positions = await this.adapter.getPositions()

      const seen = new Set<string>()
      const now = Date.now()

      for (const pos of positions) {
        seen.add(pos.symbol)
        const prev = this.lastPositions.get(pos.symbol)

        if (!prev || (prev.quantity === 0 && pos.quantity > 0)) {
          this.emitPositionOpened(pos, now)
        } else if (prev.quantity > 0 && pos.quantity === 0) {
          this.emitPositionClosed(pos, prev, now)
        } else if (prev && Math.abs(prev.quantity - pos.quantity) > 0.0001) {
          this.emitPositionUpdated(pos, now)
        }

        this.lastPositions.set(pos.symbol, pos)
      }

      // Check for positions that disappeared from broker
      for (const [symbol, prev] of this.lastPositions.entries()) {
        if (!seen.has(symbol) && prev.quantity > 0) {
          this.emitPositionClosed(prev, prev, now)
          this.lastPositions.delete(symbol)
        }
      }
    } catch (err) {
      console.error('[PositionSynchronizer] REST sync failed:', err)
    }
  }

  /** Handle a push event from broker subscription */
  private handlePositionUpdate(pos: BrokerPosition): void {
    const prev = this.lastPositions.get(pos.symbol)
    const now = Date.now()

    if (!prev || (prev.quantity === 0 && pos.quantity > 0)) {
      this.emitPositionOpened(pos, now)
    } else if (prev.quantity > 0 && pos.quantity === 0) {
      this.emitPositionClosed(pos, prev, now)
    } else {
      this.emitPositionUpdated(pos, now)
    }

    this.lastPositions.set(pos.symbol, pos)
  }

  private toPosition(pos: BrokerPosition): Position {
    return {
      symbol: pos.symbol,
      direction: pos.direction,
      quantity: pos.quantity,
      averageEntryPrice: pos.averageEntryPrice,
      currentPrice: pos.currentPrice,
      unrealizedPnl: pos.unrealizedPnl,
      realizedPnl: pos.realizedPnl,
      openedAt: 0,
      updatedAt: Date.now(),
    }
  }

  private emitPositionOpened(pos: BrokerPosition, ts: number): void {
    if (!this.eventBus) return
    this.eventBus.emit({
      type: 'POSITION_OPENED',
      position: this.toPosition(pos),
      timestamp: ts,
    })
  }

  private emitPositionClosed(pos: BrokerPosition, prev: BrokerPosition, ts: number): void {
    if (!this.eventBus) return
    const pnl = pos.realizedPnl - prev.realizedPnl
    const position: Position = {
      ...this.toPosition(pos),
      quantity: 0,
      unrealizedPnl: 0,
    }
    this.eventBus.emit({
      type: 'POSITION_CLOSED',
      position,
      realizedPnl: pnl,
      timestamp: ts,
    })
  }

  private emitPositionUpdated(pos: BrokerPosition, ts: number): void {
    if (!this.eventBus) return
    this.eventBus.emit({
      type: 'POSITION_UPDATED',
      position: this.toPosition(pos),
      timestamp: ts,
    })
  }

  dispose(): void {
    this.stop()
    this.lastPositions.clear()
    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers = []
  }
}
