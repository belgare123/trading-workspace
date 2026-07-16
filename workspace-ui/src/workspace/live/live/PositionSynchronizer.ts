/**
 * PositionSynchronizer.ts — Local ↔ broker position synchronization
 *
 * Periodically polls broker positions and emits POSITION_OPENED / POSITION_CLOSED
 * events to keep local state in sync with the exchange.
 *
 * @since 4.5
 */

import type { BrokerAdapter } from './BrokerAdapter'
import type { BrokerPositionInfo } from './types'
import type { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'
import type { Position } from '../../execution/types'

export class PositionSynchronizer {
  private adapter: BrokerAdapter
  private eventBus?: ExecutionEventBus
  private timer: ReturnType<typeof setInterval> | null = null
  private lastPositions = new Map<string, BrokerPositionInfo>() // key: symbol

  constructor(adapter: BrokerAdapter) {
    this.adapter = adapter
  }

  connectEventBus(bus: ExecutionEventBus): void {
    this.eventBus = bus
  }

  /** Start periodic sync */
  start(intervalMs = 5_000): void {
    if (this.timer) return
    this.timer = setInterval(() => this.sync(), intervalMs)
  }

  /** Stop sync */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** One-shot sync */
  async sync(): Promise<void> {
    try {
      const positions = await this.adapter.getPositions()

      const seen = new Set<string>()

      for (const pos of positions) {
        seen.add(pos.symbol)
        const prev = this.lastPositions.get(pos.symbol)

        if (!prev || (prev.quantity === 0 && pos.quantity > 0)) {
          // New position opened
          this.emitPositionOpened(pos)
        } else if (prev.quantity > 0 && pos.quantity === 0) {
          // Position closed
          this.emitPositionClosed(pos, prev)
        } else if (prev && Math.abs(prev.quantity - pos.quantity) > 0.0001) {
          // Position updated (quantity changed)
          this.emitPositionUpdated(pos, prev)
        }

        this.lastPositions.set(pos.symbol, pos)
      }

      // Check for positions that disappeared from broker
      for (const [symbol, prev] of this.lastPositions.entries()) {
        if (!seen.has(symbol) && prev.quantity > 0) {
          this.emitPositionClosed(prev, prev)
          this.lastPositions.delete(symbol)
        }
      }
    } catch (err) {
      console.error('[PositionSynchronizer] Sync failed:', err)
    }
  }

  private emitPositionOpened(pos: BrokerPositionInfo): void {
    if (!this.eventBus) return
    const position: Position = {
      symbol: pos.symbol,
      direction: pos.direction,
      quantity: pos.quantity,
      averageEntryPrice: pos.averageEntryPrice,
      currentPrice: pos.currentPrice,
      unrealizedPnl: pos.unrealizedPnl,
      realizedPnl: pos.realizedPnl,
      openedAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.eventBus.emit({
      type: 'POSITION_OPENED',
      position,
      timestamp: Date.now(),
    })
  }

  private emitPositionClosed(pos: BrokerPositionInfo, prev: BrokerPositionInfo): void {
    if (!this.eventBus) return
    const pnl = pos.realizedPnl - prev.realizedPnl
    const position: Position = {
      symbol: pos.symbol,
      direction: pos.direction,
      quantity: 0,
      averageEntryPrice: prev.averageEntryPrice,
      currentPrice: pos.currentPrice,
      unrealizedPnl: 0,
      realizedPnl: pos.realizedPnl,
      openedAt: 0,
      updatedAt: Date.now(),
    }
    this.eventBus.emit({
      type: 'POSITION_CLOSED',
      position,
      realizedPnl: pnl,
      timestamp: Date.now(),
    })
  }

  private emitPositionUpdated(pos: BrokerPositionInfo, prev: BrokerPositionInfo): void {
    if (!this.eventBus) return
    const position: Position = {
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
    this.eventBus.emit({
      type: 'POSITION_UPDATED',
      position,
      previousPosition: prev ? {
        symbol: prev.symbol,
        direction: prev.direction,
        quantity: prev.quantity,
        averageEntryPrice: prev.averageEntryPrice,
        currentPrice: prev.currentPrice,
        unrealizedPnl: prev.unrealizedPnl,
        realizedPnl: prev.realizedPnl,
        openedAt: 0,
        updatedAt: 0,
      } : undefined,
      timestamp: Date.now(),
    })
  }

  dispose(): void {
    this.stop()
    this.lastPositions.clear()
  }
}
