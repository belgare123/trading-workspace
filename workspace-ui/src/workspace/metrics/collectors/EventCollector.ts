// ── EventCollector — Captures all Execution events for replay / analysis ──
//
// @since 3.5.2

import type { ExecutionEvent, Collector, EventBusHandle } from '../types'

export class EventCollector implements Collector {
  readonly id = 'event-collector'
  private _events: ExecutionEvent[] = []
  private unsub: (() => void) | null = null

  connect(bus: EventBusHandle): void {
    this.unsub = bus.subscribe(event => {
      this._events.push(event)
    })
  }

  /** All events in chronological order */
  get events(): ExecutionEvent[] {
    return [...this._events]
  }

  /** Filter events by type */
  byType<K extends ExecutionEvent['type']>(type: K): Extract<ExecutionEvent, { type: K }>[] {
    return this._events.filter((e): e is Extract<ExecutionEvent, { type: K }> => e.type === type)
  }

  /** Count of events by type */
  countByType(): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const e of this._events) {
      counts[e.type] = (counts[e.type] ?? 0) + 1
    }
    return counts
  }

  get size(): number {
    return this._events.length
  }

  reset(): void {
    this._events = []
    this.unsub?.()
    this.unsub = null
  }
}
