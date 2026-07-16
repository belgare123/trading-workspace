// ── GraphScheduler — event-driven execution trigger ──
//
// Determines when graph nodes should be evaluated.
// Initially supports bar-based scheduling (onBar).
// Future: onTick, onTrade, onTimer, onNews, onCustomEvent.
//
// @since 3.4.6

import type { ScheduleEvent, GraphExecutionContext } from '../types'

export type ScheduleHandler = (
  event: ScheduleEvent,
  ctx: GraphExecutionContext,
) => Promise<void>

export class GraphScheduler {
  private readonly _handlers = new Map<ScheduleEvent, ScheduleHandler[]>()
  private _timerId: ReturnType<typeof setInterval> | null = null

  /** Register a handler for a specific event type */
  on(event: ScheduleEvent, handler: ScheduleHandler): void {
    const handlers = this._handlers.get(event) ?? []
    handlers.push(handler)
    this._handlers.set(event, handlers)
  }

  /** Remove a handler */
  off(event: ScheduleEvent, handler: ScheduleHandler): void {
    const handlers = this._handlers.get(event)
    if (!handlers) return
    const idx = handlers.indexOf(handler)
    if (idx >= 0) handlers.splice(idx, 1)
  }

  /** Trigger an event */
  async emit(event: ScheduleEvent, ctx: GraphExecutionContext): Promise<void> {
    const handlers = this._handlers.get(event)
    if (!handlers || handlers.length === 0) return
    await Promise.all(handlers.map(h => h(event, ctx)))
  }

  /** Check if any handlers are registered for an event */
  hasHandlers(event: ScheduleEvent): boolean {
    return (this._handlers.get(event)?.length ?? 0) > 0
  }

  /** Start a periodic timer (for onTimer events) */
  startTimer(intervalMs: number): void {
    this.stopTimer()
    this._timerId = setInterval(async () => {
      await this.emit('onTimer', {})
    }, intervalMs)
  }

  /** Stop the periodic timer */
  stopTimer(): void {
    if (this._timerId !== null) {
      clearInterval(this._timerId)
      this._timerId = null
    }
  }

  /** Remove all handlers */
  clear(): void {
    this._handlers.clear()
    this.stopTimer()
  }
}
