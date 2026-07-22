/**
 * ChaosTraceRuntime.ts — Central chaos incident store
 *
 * Sprint 6.6.2a — a lightweight runtime service that manages the
 * lifecycle of active chaos traces, records phase events, and
 * provides query access for metrics, health, and the wider
 * observability stack (EventJournal, Telemetry, ReplayEngine).
 *
 * Design principles:
 * - FailureInjector knows nothing about storage — it only calls
 *   onChaosTrace / onChaosEvent on its observer
 * - ChaosTraceRuntime implements IFailureObserver and translates
 *   observer calls into trace lifecycle management
 * - Completed traces can be retained (bounded) for post-mortem
 *   analysis without leaking memory
 *
 * @since 6.6.2a
 */

import type {
  ChaosTrace,
  ChaosTraceEvent,
  ChaosTraceStatus,
  ChaosTraceSeverity,
} from './ChaosTrace'
import {
  TraceEventJournal,
  computeSeverity,
} from './ChaosTrace'
import type { IFailureObserver } from './IFailureObserver'
import type { FailureInjectionScope } from './InjectionRule'

// ── Retention config ──

export interface ChaosTraceRuntimeOptions {
  /** Max completed traces to retain (0 = unlimited, default 1000) */
  maxCompletedTraces?: number
}

// ════════════════════════════════════════════

export class ChaosTraceRuntime implements IFailureObserver {
  private readonly activeTraces = new Map<string, InternalTraceState>()
  private readonly completedTraces: InternalTraceState[] = []
  private readonly maxCompleted: number

  constructor(options?: ChaosTraceRuntimeOptions) {
    this.maxCompleted = options?.maxCompletedTraces ?? 1000
  }

  // ── IFailureObserver ──

  /**
   * Called when a chaos trace is created or its status changes.
   * Transitions:
   *   running  → stored as active
   *   completed/failed/cancelled  → moved from active to completed
   * On terminal status, severity is computed automatically.
   */
  onChaosTrace(trace: ChaosTrace): void {
    if (trace.status === 'running') {
      const existing = this.activeTraces.get(trace.id)
      if (existing) {
        // Update existing active trace (e.g. error propagation)
        existing.trace = { ...trace }
      } else {
        // New trace
        this.activeTraces.set(trace.id, {
          trace: { ...trace },
          journal: new TraceEventJournal(trace.id),
        })
      }
    } else {
      // Terminal status — move from active to completed
      const state = this.activeTraces.get(trace.id)
      if (state) {
        // Compute severity from terminal trace data
        const durationMs = trace.finishedAt && trace.startedAt
          ? trace.finishedAt - trace.startedAt
          : undefined
        state.trace = {
          ...trace,
          severity: computeSeverity({
            actionType: trace.actionType,
            scope: trace.scope,
            durationMs,
          }),
        }
        this.activeTraces.delete(trace.id)
        this.addCompleted(state)
      }
    }
  }

  /**
   * Called for each phase event within a trace.
   * Appends to the trace's event journal.
   */
  onChaosEvent(event: ChaosTraceEvent): void {
    const state =
      this.activeTraces.get(event.traceId) ??
      this.completedTraces.find(t => t.trace.id === event.traceId)

    if (state) {
      state.journal.append(event.phase, event.message, event.data)
    }
  }

  // ── Queries ──

  /** All currently active (running) traces */
  getActiveTraces(): readonly ChaosTrace[] {
    return Array.from(this.activeTraces.values()).map(s => ({ ...s.trace }))
  }

  /** A specific active trace by id */
  getActiveTrace(id: string): ChaosTrace | undefined {
    return this.activeTraces.get(id)?.trace
  }

  /** Completed traces */
  getCompletedTraces(): readonly ChaosTrace[] {
    return this.completedTraces.map(s => ({ ...s.trace }))
  }

  /** Total traces seen (active + completed) */
  get totalTraces(): number {
    return this.activeTraces.size + this.completedTraces.length
  }

  /** Active trace count */
  get activeCount(): number {
    return this.activeTraces.size
  }

  /** Get the event journal for a trace (active or completed) */
  getJournal(traceId: string): TraceEventJournal | undefined {
    return (
      this.activeTraces.get(traceId)?.journal ??
      this.completedTraces.find(t => t.trace.id === traceId)?.journal
    )
  }

  /** All events for a trace (convenience) */
  getTraceEvents(traceId: string): readonly ChaosTraceEvent[] {
    return this.getJournal(traceId)?.events ?? []
  }

  /** Clear all completed traces (memory management) */
  clearCompleted(): void {
    this.completedTraces.length = 0
  }

  /** Clear everything */
  reset(): void {
    this.activeTraces.clear()
    this.completedTraces.length = 0
  }

  /**
   * Export a complete timeline for a trace (active or completed).
   * Returns a structured incident report suitable for attaching to
   * alerts, storing in EventJournal, or feeding into ReplayEngine.
   */
  export(traceId: string): ChaosTraceExport | undefined {
    const state =
      this.activeTraces.get(traceId) ??
      this.completedTraces.find(t => t.trace.id === traceId)

    if (!state) return undefined

    const trace = state.trace
    const events = state.journal.events
    const durationMs = trace.finishedAt && trace.startedAt
      ? trace.finishedAt - trace.startedAt
      : undefined

    return {
      trace: { ...trace },
      events: [...events],
      durationMs,
      eventCount: events.length,
      severity: trace.severity ?? computeSeverity({
        actionType: trace.actionType,
        scope: trace.scope,
        durationMs,
      }),
    }
  }

  // ── Stats ──

  get stats(): ChaosTraceRuntimeStats {
    const all = [
      ...Array.from(this.activeTraces.values()).map(s => s.trace),
      ...this.completedTraces.map(s => s.trace),
    ]
    const byStatus = new Map<ChaosTraceStatus, number>()
    const byScope = new Map<string, number>()
    const byAction = new Map<string, number>()

    for (const t of all) {
      byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1)
      byScope.set(t.scope, (byScope.get(t.scope) ?? 0) + 1)
      byAction.set(t.actionType, (byAction.get(t.actionType) ?? 0) + 1)
    }

    const completedWithDuration = all.filter(t => t.finishedAt && t.startedAt)
    const avgDurationMs =
      completedWithDuration.length > 0
        ? completedWithDuration.reduce((sum, t) => sum + (t.finishedAt! - t.startedAt), 0) /
          completedWithDuration.length
        : 0

    // Severity distribution among completed traces
    const bySeverity = new Map<string, number>()
    for (const t of this.completedTraces.map(s => s.trace)) {
      const sev = t.severity ?? 'warning'
      bySeverity.set(sev, (bySeverity.get(sev) ?? 0) + 1)
    }

    return {
      active: this.activeTraces.size,
      completed: this.completedTraces.length,
      total: all.length,
      byStatus: Object.fromEntries(byStatus),
      byScope: Object.fromEntries(byScope),
      byAction: Object.fromEntries(byAction),
      avgDurationMs: Math.round(avgDurationMs),
      bySeverity: Object.fromEntries(bySeverity),
    }
  }

  // ── Private ──

  private addCompleted(state: InternalTraceState): void {
    this.completedTraces.push(state)
    if (this.maxCompleted > 0 && this.completedTraces.length > this.maxCompleted) {
      this.completedTraces.splice(0, this.completedTraces.length - this.maxCompleted)
    }
  }
}

// ── Runtime stats ──

export interface ChaosTraceRuntimeStats {
  active: number
  completed: number
  total: number
  byStatus: Record<string, number>
  byScope: Record<string, number>
  byAction: Record<string, number>
  avgDurationMs: number
  /** Distribution of computed severities among completed traces */
  bySeverity?: Record<string, number>
}

// ── Internal state ──

interface InternalTraceState {
  trace: ChaosTrace
  journal: TraceEventJournal
}

/**
 * Structured incident report returned by ChaosTraceRuntime.export().
 * Combines the trace, its event timeline, computed severity, and
 * metadata for attachment to alerts, EventJournal, or ReplayEngine.
 *
 * @since 6.6 Correlation & Timeline enhancements
 */
export interface ChaosTraceExport {
  trace: ChaosTrace
  events: readonly ChaosTraceEvent[]
  durationMs?: number
  eventCount: number
  severity: ChaosTraceSeverity
}
