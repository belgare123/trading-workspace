// ── WalletEventBus — typed event bus for wallet events ──
// Sprint 5.6 — WalletManager

import type { WalletEvent, WalletEventHandler } from '../types'

export class WalletEventBus {
  private readonly _handlers = new Map<string, Set<WalletEventHandler>>()

  emit(event: WalletEvent): void {
    const handlers = this._handlers.get(event.type)
    if (handlers) {
      for (const h of handlers) h(event)
    }
  }

  on(eventType: string, handler: WalletEventHandler): () => void {
    const handlers = this._handlers.get(eventType) ?? new Set()
    handlers.add(handler)
    this._handlers.set(eventType, handlers)
    return () => {
      handlers.delete(handler)
      if (handlers.size === 0) this._handlers.delete(eventType)
    }
  }

  off(eventType: string, handler: WalletEventHandler): void {
    const handlers = this._handlers.get(eventType)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) this._handlers.delete(eventType)
    }
  }

  clear(): void {
    this._handlers.clear()
  }
}
