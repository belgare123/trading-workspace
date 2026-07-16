/**
 * MarketEventBus.ts — Typed event bus for market data
 *
 * Provides a publish/subscribe mechanism for MarketEvents.
 * Used by LiveFeedRuntime to fan out data to all consumers.
 *
 * @since 4.2
 */

import type { MarketEvent } from '../types'

type EventHandler = (event: MarketEvent) => void

export class MarketEventBus {
  private handlers = new Map<string, Set<EventHandler>>()

  /** Subscribe to a specific event type */
  on(eventType: MarketEvent['type'], handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)!.add(handler)
  }

  /** Unsubscribe */
  off(eventType: MarketEvent['type'], handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler)
  }

  /** Publish an event to all subscribers */
  emit(event: MarketEvent): void {
    const handlers = this.handlers.get(event.type)
    if (!handlers) return
    for (const handler of handlers) {
      try {
        handler(event)
      } catch (err) {
        console.error(`[MarketEventBus] Handler error for ${event.type}:`, err)
      }
    }
  }

  /** Remove all listeners */
  clear(): void {
    this.handlers.clear()
  }

  /** Get subscriber count for an event type */
  listenerCount(eventType: MarketEvent['type']): number {
    return this.handlers.get(eventType)?.size ?? 0
  }
}
