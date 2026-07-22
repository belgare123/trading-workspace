// ── LifecycleManager — FSM for the trading pipeline ──
// Sprint 5.4 — Workspace Composition & Lifecycle
//
// States:
//   CREATED → INITIALIZING → RECOVERING → RUNNING → DEGRADED → STOPPING → STOPPED
//                                            ↑         │
//                                            └─────────┘ (from DEGRADED back to RUNNING)

import type {
  LifecycleState,
  LifecycleEventType,
  LifecycleEventHandler,
  RecoveryReport,
} from './types'

import {
  LIFECYCLE_STATES,
  LIFECYCLE_TRANSITIONS,
} from './types'

// ════════════════════════════════════════
// Errors
// ════════════════════════════════════════

export class LifecycleError extends Error {
  constructor(
    message: string,
    public readonly fromState: LifecycleState,
    public readonly targetState?: LifecycleState,
  ) {
    super(message)
    this.name = 'LifecycleError'
  }
}

export class InvalidTransitionError extends LifecycleError {
  constructor(from: LifecycleState, to: LifecycleState) {
    super(
      `Invalid transition: ${from} → ${to}. Allowed: ${LIFECYCLE_TRANSITIONS[from].join(', ') || '(none)'}`,
      from,
      to,
    )
    this.name = 'InvalidTransitionError'
  }
}

// ════════════════════════════════════════
// LifecycleManager
// ════════════════════════════════════════

export class LifecycleManager {
  private _state: LifecycleState = LIFECYCLE_STATES.CREATED
  private _startTime = 0
  private _lastRecoveryReport?: RecoveryReport
  private _error?: Error

  private readonly listeners = new Set<LifecycleEventHandler>()

  // ── Initial state ──

  get state(): LifecycleState {
    return this._state
  }

  get isRunning(): boolean {
    return this._state === LIFECYCLE_STATES.RUNNING
  }

  get isStopped(): boolean {
    return this._state === LIFECYCLE_STATES.STOPPED
  }

  get uptimeMs(): number {
    if (this._startTime === 0) return 0
    return Date.now() - this._startTime
  }

  get lastRecoveryReport(): RecoveryReport | undefined {
    return this._lastRecoveryReport
  }

  get error(): Error | undefined {
    return this._error
  }

  // ── Event system ──

  on(handler: LifecycleEventHandler): () => void {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  private emit(event: LifecycleEventType, detail?: unknown): void {
    for (const handler of this.listeners) {
      try {
        handler(event, this._state, detail)
      } catch {
        // Listener errors are swallowed
      }
    }
  }

  // ── State machine ──

  private assertTransition(target: LifecycleState): void {
    const allowed = LIFECYCLE_TRANSITIONS[this._state]
    if (!allowed.includes(target)) {
      throw new InvalidTransitionError(this._state, target)
    }
  }

  /**
   * Transition to a new state.
   * Throws InvalidTransitionError if the transition is not allowed.
   */
  transition(target: LifecycleState): void {
    this.assertTransition(target)

    const previous = this._state
    this.emit('state:exited', previous)
    this._state = target
    this.emit('state:entered')

    if (target === LIFECYCLE_STATES.RUNNING && this._startTime === 0) {
      this._startTime = Date.now()
    }
  }

  /**
   * Transition to INITIALIZING.
   * Called by TradingComposition.init().
   */
  init(): void {
    this.assertTransition(LIFECYCLE_STATES.INITIALIZING)
    this._error = undefined
    this.transition(LIFECYCLE_STATES.INITIALIZING)
  }

  /**
   * Transition to RECOVERING after initialization.
   */
  startRecovery(): void {
    this.transition(LIFECYCLE_STATES.RECOVERING)
  }

  /**
   * Mark recovery complete and transition to RUNNING (or DEGRADED if warnings).
   */
  completeRecovery(report?: RecoveryReport): void {
    this._lastRecoveryReport = report
    if (report && !report.healthy) {
      this.transition(LIFECYCLE_STATES.DEGRADED)
    } else {
      this.transition(LIFECYCLE_STATES.RUNNING)
    }
  }

  /**
   * Transition to DEGRADED (e.g., partial connectivity loss, risk breach).
   */
  degrade(error?: Error): void {
    this._error = error
    this.transition(LIFECYCLE_STATES.DEGRADED)
  }

  /**
   * Recover from DEGRADED back to RUNNING.
   */
  recover(): void {
    this.assertTransition(LIFECYCLE_STATES.RUNNING)
    this._error = undefined
    this.transition(LIFECYCLE_STATES.RUNNING)
  }

  /**
   * Transition to SAFE_MODE — block new trades, manage existing positions.
   */
  enterSafeMode(): void {
    this.transition(LIFECYCLE_STATES.SAFE_MODE)
  }

  /**
   * Exit SAFE_MODE back to RUNNING.
   */
  exitSafeMode(): void {
    this.assertTransition(LIFECYCLE_STATES.RUNNING)
    this._error = undefined
    this.transition(LIFECYCLE_STATES.RUNNING)
  }

  /**
   * Begin graceful shutdown. Transition to STOPPING.
   */
  stop(): void {
    this.transition(LIFECYCLE_STATES.STOPPING)
  }

  /**
   * Finalize shutdown. Transition to STOPPED.
   */
  finalize(): void {
    this.transition(LIFECYCLE_STATES.STOPPED)
  }
}
