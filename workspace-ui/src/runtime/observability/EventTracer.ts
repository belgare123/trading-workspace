/**
 * EventTracer — runtime timeline per trace ID.
 *
 * Records every significant event through the pipeline stages:
 *   Signal → Risk → Wallet → Gateway → Exchange ACK → Fill → Position → Exit → Closed
 *
 * For each trace ID, builds a chronological timeline that can be
 * exported as JSON for debugging or shown in Grafana.
 *
 * Usage:
 *   const tracer = new EventTracer()
 *   tracer.record('order_abc', 'strategy', 'Signal generated', { price: 0.5432 })
 *   tracer.record('order_abc', 'gateway', 'Order submitted', { orderId: 'ex-123' })
 *   const timeline = tracer.getTimeline('order_abc')
 *
 * @since 6.1.0
 */

/* ── Types ── */

export interface TraceEvent {
  /** Event timestamp (ISO-8601) */
  timestamp: string
  /** Which module emitted this (strategy, risk, gateway, etc.) */
  stage: string
  /** Short description */
  label: string
  /** Duration since the previous event on this trace (ms) */
  delta_ms: number | null
  /** Duration since the first event on this trace (ms) */
  cumulative_ms: number
  /** Optional detail / context */
  detail?: string
  /** Optional structured data */
  data?: Record<string, unknown>
}

export interface Timeline {
  traceId: string
  startedAt: string
  completedAt: string | null
  totalDuration_ms: number | null
  events: TraceEvent[]
}

/* ── Tracer ── */

const MAX_EVENTS_PER_TRACE = 500
const MAX_TRACES = 10_000

export class EventTracer {
  private readonly _traces = new Map<string, TraceEvent[]>()
  private readonly _started = new Map<string, number>()
  private _totalEvents = 0

  /** Record an event on a trace */
  record(traceId: string, stage: string, label: string, data?: Record<string, unknown>): void {
    let events = this._traces.get(traceId)
    if (!events) {
      events = []
      this._traces.set(traceId, events)
      this._started.set(traceId, Date.now())
    }

    if (events.length >= MAX_EVENTS_PER_TRACE) return

    const now = Date.now()
    const start = this._started.get(traceId)!
    const prev = events.length > 0 ? events[events.length - 1] : null
    const prevTime = prev ? new Date(prev.timestamp).getTime() : start

    events.push({
      timestamp: new Date(now).toISOString(),
      stage,
      label,
      delta_ms: events.length === 0 ? null : Math.round(now - prevTime),
      cumulative_ms: Math.round(now - start),
      detail: data?.detail as string | undefined,
      data,
    })

    this._totalEvents++

    // Prune oldest traces if we exceed limit
    if (this._traces.size > MAX_TRACES) {
      const oldest = this._traces.keys().next().value
      if (oldest !== undefined) {
        this._traces.delete(oldest)
        this._started.delete(oldest)
      }
    }
  }

  /** Get full timeline for a trace ID */
  getTimeline(traceId: string): Timeline | null {
    const events = this._traces.get(traceId)
    if (!events) return null

    const start = this._started.get(traceId)!
    const lastEvent = events[events.length - 1]
    const completedAt = events.length > 0 ? events[events.length - 1].timestamp : null
    const totalDuration = events.length > 0
      ? Math.round(Date.now() - start)
      : null

    return {
      traceId,
      startedAt: events[0]?.timestamp ?? new Date(start).toISOString(),
      completedAt,
      totalDuration_ms: totalDuration,
      events,
    }
  }

  /** Get all recent timelines (sorted by most recent event) */
  getRecentTimelines(limit = 20): Timeline[] {
    return Array.from(this._traces.keys())
      .map(id => this.getTimeline(id)!)
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = a.events[a.events.length - 1]?.timestamp ?? ''
        const bTime = b.events[b.events.length - 1]?.timestamp ?? ''
        return bTime.localeCompare(aTime)
      })
      .slice(0, limit)
  }

  /** Get a specific stage's events across all traces */
  getEventsByStage(stage: string, limit = 100): TraceEvent[] {
    const result: TraceEvent[] = []
    for (const events of this._traces.values()) {
      for (const ev of events) {
        if (ev.stage === stage) {
          result.push(ev)
          if (result.length >= limit) return result
        }
      }
    }
    return result
  }

  /** Check if a trace exists */
  hasTrace(traceId: string): boolean {
    return this._traces.has(traceId)
  }

  /** Clear specific trace */
  clearTrace(traceId: string): void {
    this._traces.delete(traceId)
    this._started.delete(traceId)
  }

  /** Clear all traces */
  clearAll(): void {
    this._traces.clear()
    this._started.clear()
    this._totalEvents = 0
  }

  /** Export all traces as JSON array */
  exportAll(): Timeline[] {
    return Array.from(this._traces.keys()).map(id => this.getTimeline(id)!)
  }

  /** Total events recorded across all traces */
  get totalEvents(): number {
    return this._totalEvents
  }

  /** Number of active traces */
  get activeTraceCount(): number {
    return this._traces.size
  }
}
