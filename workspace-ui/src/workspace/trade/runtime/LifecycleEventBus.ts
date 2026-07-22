// ── LifecycleEventBus — typed event bus ──

import {
  TradeEventType,
  type AnyTradeEvent,
  type TradeLifecycleEvent,
} from '../TradeLifecycleEvent'

export type EventHandler = (event: TradeLifecycleEvent) => void

/** Simple typed event bus for Lifecycle Events */
export class LifecycleEventBus {
  private handlers = new Map<string, Set<EventHandler>>()

  /** Subscribe to a specific event type or '*' for all */
  on(eventType: TradeEventType | '*', handler: EventHandler): () => void {
    const key = eventType
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set())
    }
    this.handlers.get(key)!.add(handler)

    // Return unsubscribe function
    return () => {
      this.handlers.get(key)?.delete(handler)
    }
  }

  /** Unsubscribe a specific handler */
  off(eventType: TradeEventType | '*', handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler)
  }

  /** Emit event to all subscribers */
  emit(event: AnyTradeEvent): void {
    // Notify type-specific subscribers
    const typeHandlers = this.handlers.get(event.type)
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        handler(event)
      }
    }

    // Notify wildcard subscribers
    const wildcardHandlers = this.handlers.get('*')
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        handler(event)
      }
    }
  }

  /** Remove all subscribers */
  clear(): void {
    this.handlers.clear()
  }

  /** Number of subscribed handlers */
  get subscriberCount(): number {
    let count = 0
    for (const handlers of this.handlers.values()) {
      count += handlers.size
    }
    return count
  }
}
