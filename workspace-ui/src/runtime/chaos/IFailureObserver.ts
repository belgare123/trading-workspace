/**
 * IFailureObserver.ts — Observer interface for Chaos Runtime events
 *
 * Sprint 6.6.2a: extended with ChaosTrace domain events.
 * The original `observe(FailureObservation)` path is preserved for
 * backward compatibility; new consumers should prefer `onChaosTrace`
 * and `onChaosEvent` for structured incident tracking.
 *
 * Usage:
 *   const injector = new FailureInjector()
 *   injector.addObserver(new LoggingObserver(logger))
 *   injector.addObserver(new ChaosTraceRuntime())
 *
 * All methods are synchronous by default. Errors from individual
 * observers are caught and swallowed so they never block the caller.
 *
 * @since 6.6
 */

import type { FailureContext, InjectionAction } from './InjectionRule'
import type { ChaosTrace, ChaosTraceEvent } from './ChaosTrace'

// ── Legacy event types (preserved) ──

export interface FailureObservation {
  /** Discriminated event type */
  type:
    | 'injection_started'
    | 'injection_finished'
    | 'rule_matched'
    | 'scenario_started'
    | 'scenario_completed'
    | 'scenario_stopped'

  /** When the event occurred */
  timestamp: number

  /** The failure context at the time of the event */
  context?: FailureContext

  /** The action that was (or will be) applied */
  action?: InjectionAction

  /** ID of the rule that matched (if applicable) */
  ruleId?: string

  /** ID of the scenario (if scenario event) */
  scenarioId?: string

  /** How long the injection took from start to finish (ms) */
  durationMs?: number

  /** Error message if the injection itself failed */
  error?: string
}

/**
 * Observer contract for Chaos Runtime events.
 *
 * Implementations MUST NOT throw — errors from observers are caught
 * and swallowed by the caller.
 */
export interface IFailureObserver {
  /** Called for every observable event in the chaos runtime (legacy path) */
  observe(event: FailureObservation): void

  /**
   * Called when a chaos trace is created or its status changes.
   * @since 6.6.2a
   */
  onChaosTrace?(trace: ChaosTrace): void

  /**
   * Called for each phase event within a chaos trace.
   * @since 6.6.2a
   */
  onChaosEvent?(event: ChaosTraceEvent): void
}

// ════════════════════════════════════════════
// Composite observer — fan-out to multiple backends
// ════════════════════════════════════════════

export class CompositeFailureObserver implements IFailureObserver {
  private readonly observers: IFailureObserver[] = []

  add(observer: IFailureObserver): void {
    this.observers.push(observer)
  }

  remove(observer: IFailureObserver): void {
    const idx = this.observers.indexOf(observer)
    if (idx >= 0) this.observers.splice(idx, 1)
  }

  observe(event: FailureObservation): void {
    for (const observer of this.observers) {
      try { observer.observe(event) } catch { /* swallow */ }
    }
  }

  onChaosTrace(trace: ChaosTrace): void {
    for (const observer of this.observers) {
      try { observer.onChaosTrace?.(trace) } catch { /* swallow */ }
    }
  }

  onChaosEvent(event: ChaosTraceEvent): void {
    for (const observer of this.observers) {
      try { observer.onChaosEvent?.(event) } catch { /* swallow */ }
    }
  }
}

// ════════════════════════════════════════════
// No-op observer (default, does nothing)
// ════════════════════════════════════════════

export class NoopFailureObserver implements IFailureObserver {
  observe(_event: FailureObservation): void {
    // noop
  }
  onChaosTrace(_trace: ChaosTrace): void {
    // noop
  }
  onChaosEvent(_event: ChaosTraceEvent): void {
    // noop
  }
}
