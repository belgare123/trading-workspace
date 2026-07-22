// ── OrderEventBus — typed event bus for OrderManager events ──

import { OrderEventType, type OrderEvent, type OrderEventHandler } from '../../runtime/interfaces'

export class OrderEventBus {
  private listeners = new Map<string, Set<OrderEventHandler>>()
  private wildcardListeners = new Set<OrderEventHandler>()

  emit(event: OrderEvent): void {
    // Wildcard listeners
    for (const handler of this.wildcardListeners) {
      try { handler(event) } catch { /* isolate handler errors */ }
    }

    // Type-specific listeners
    const handlers = this.listeners.get(event.type)
    if (handlers) {
      for (const handler of handlers) {
        try { handler(event) } catch { /* isolate handler errors */ }
      }
    }
  }

  on(eventType: OrderEventType | '*', handler: OrderEventHandler): () => void {
    if (eventType === '*') {
      this.wildcardListeners.add(handler)
      return () => { this.wildcardListeners.delete(handler) }
    }
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(handler)
    return () => { this.listeners.get(eventType)?.delete(handler) }
  }

  off(eventType: OrderEventType | '*', handler: OrderEventHandler): void {
    if (eventType === '*') {
      this.wildcardListeners.delete(handler)
      return
    }
    this.listeners.get(eventType)?.delete(handler)
  }

  removeAll(): void {
    this.listeners.clear()
    this.wildcardListeners.clear()
  }
}
