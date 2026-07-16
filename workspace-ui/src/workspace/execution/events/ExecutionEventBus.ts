// ── ExecutionEventBus — typed event bus for Execution Simulator ──
//
// Lightweight implementation. Emit is synchronous — consumers run in
// registration order during the current tick.
//
// @since 3.5.1

import type {
  ExecutionEvent,
  ExecutionEventBus as IExecutionEventBus,
  EventHandler,
} from './ExecutionEvents'

export class ExecutionEventBus implements IExecutionEventBus {
  private globalHandlers: Set<EventHandler> = new Set()
  private typedHandlers: Map<string, Set<EventHandler>> = new Map()

  subscribe(handler: EventHandler): () => void {
    this.globalHandlers.add(handler)
    return () => { this.globalHandlers.delete(handler) }
  }

  on<K extends ExecutionEvent['type']>(
    type: K,
    handler: (event: Extract<ExecutionEvent, { type: K }>) => void,
  ): () => void {
    const handlers = this.typedHandlers.get(type) ?? new Set()
    handlers.add(handler as EventHandler)
    this.typedHandlers.set(type, handlers)
    return () => { handlers.delete(handler as EventHandler) }
  }

  emit(event: ExecutionEvent): void {
    // Global
    for (const handler of this.globalHandlers) {
      handler(event)
    }
    // Typed
    const typed = this.typedHandlers.get(event.type)
    if (typed) {
      for (const handler of typed) {
        handler(event)
      }
    }
  }

  clear(): void {
    this.globalHandlers.clear()
    this.typedHandlers.clear()
  }

  subscriberCount(): number {
    let count = this.globalHandlers.size
    for (const handlers of this.typedHandlers.values()) {
      count += handlers.size
    }
    return count
  }
}
