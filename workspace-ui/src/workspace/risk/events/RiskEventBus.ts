/**
 * RiskEventBus.ts — Typed event bus for risk runtime events
 *
 * @since 4.7
 */

import type { RiskEventType, RiskEventPayload, RiskEventHandler } from './RiskEvents'

export class RiskEventBus {
  private listeners: Map<RiskEventType, Set<RiskEventHandler>> = new Map()

  on<T extends RiskEventType>(event: T, handler: RiskEventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as RiskEventHandler)

    return () => {
      this.listeners.get(event)?.delete(handler as RiskEventHandler)
    }
  }

  emit<T extends RiskEventType>(event: T, payload: RiskEventPayload[T]): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    for (const handler of handlers) {
      try {
        handler(payload)
      } catch {
        // Silently ignore handler errors
      }
    }
  }

  off<T extends RiskEventType>(event: T, handler: RiskEventHandler<T>): void {
    this.listeners.get(event)?.delete(handler as RiskEventHandler)
  }

  removeAll(): void {
    this.listeners.clear()
  }
}
