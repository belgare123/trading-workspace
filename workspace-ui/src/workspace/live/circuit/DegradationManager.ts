/**
 * DegradationManager — Integrates CircuitBreaker with LifecycleManager's Safe Mode.
 *
 * When circuit enters DEGRADED state:
 *   1. Transition lifecycle to SAFE_MODE
 *   2. Emit system degradation event
 *   3. Log structured degradation report
 *
 * When circuit recovers to CLOSED:
 *   1. Transition lifecycle back to RUNNING
 *   2. Emit recovery event
 *
 * @since 6.2.0
 */

import { CircuitBreaker, type CircuitBreakerSnapshot, type CircuitState } from './CircuitBreaker'

export interface LifecycleActions {
  enterSafeMode: () => void
  exitSafeMode: () => void
}

export type DegradationReason = 'circuit_open' | 'circuit_degraded' | 'manual' | 'unknown'

export interface DegradationEvent {
  reason: DegradationReason
  circuitName: string
  previousState: CircuitState
  currentState: CircuitState
  failureCount: number
  timestamp: number
  message: string
}

export interface DegradationListener {
  (event: DegradationEvent): void
}

export class DegradationManager {
  private _circuit: CircuitBreaker
  private _lifecycle: LifecycleActions
  private _listeners: DegradationListener[] = []
  private _isDegraded = false

  constructor(circuit: CircuitBreaker, lifecycle: LifecycleActions) {
    this._circuit = circuit
    this._lifecycle = lifecycle

    // Wire into circuit state changes
    circuit.onStateChange((from, to, reason) => {
      this._onCircuitStateChange(from, to, reason)
    })
  }

  // ── Events ──

  onDegradation(listener: DegradationListener): void {
    this._listeners.push(listener)
  }

  // ── Queries ──

  get isDegraded(): boolean {
    return this._isDegraded
  }

  // ── Private ──

  private _onCircuitStateChange(from: CircuitState, to: CircuitState, reason: string): void {
    // Transition to SAFE_MODE on DEGRADED/OPEN
    if (
      (to === 'DEGRADED' || (to === 'OPEN' && from === 'CLOSED')) &&
      !this._isDegraded
    ) {
      this._enterDegradation(to, reason)
    }

    // Exit SAFE_MODE on CLOSED
    if (to === 'CLOSED' && this._isDegraded) {
      this._exitDegradation(to, reason)
    }
  }

  private _enterDegradation(state: CircuitState, reason: string): void {
    const snapshot = this._circuit.snapshot()
    this._isDegraded = true
    this._lifecycle.enterSafeMode()

    const event: DegradationEvent = {
      reason: state === 'DEGRADED' ? 'circuit_degraded' : 'circuit_open',
      circuitName: this._circuit.name,
      previousState: state === 'DEGRADED' ? 'OPEN' : 'CLOSED',
      currentState: state,
      failureCount: snapshot.failures.total,
      timestamp: Date.now(),
      message: reason,
    }

    this._emit(event)
  }

  private _exitDegradation(state: CircuitState, reason: string): void {
    this._isDegraded = false
    this._lifecycle.exitSafeMode()

    this._emit({
      reason: 'unknown', // recovery
      circuitName: this._circuit.name,
      previousState: state,
      currentState: 'CLOSED',
      failureCount: 0,
      timestamp: Date.now(),
      message: reason,
    })
  }

  private _emit(event: DegradationEvent): void {
    for (const listener of this._listeners) {
      try {
        listener(event)
      } catch {
        // Don't let listener errors break the chain
      }
    }
  }
}
