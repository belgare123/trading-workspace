/**
 * CircuitBreakerFSM — Pure finite state machine for circuit breaker.
 *
 * States:
 *   CLOSED     — Normal operation. All requests pass through.
 *   OPEN       — Fail-fast. All requests rejected immediately.
 *   HALF_OPEN  — Probe mode. Limited requests allowed to test recovery.
 *   DEGRADED   — Extended failure. Platform should enter Safe Mode.
 *   RECOVERING — Coming back from degradation, evaluating stability.
 *
 * Allowed transitions:
 *   CLOSED    → OPEN        (failure threshold exceeded)
 *   OPEN      → HALF_OPEN   (cooldown timer expired)
 *   HALF_OPEN → CLOSED      (probe succeeded)
 *   HALF_OPEN → OPEN        (probe failed)
 *   OPEN      → DEGRADED    (opened repeatedly, extended failure)
 *   DEGRADED  → RECOVERING  (conditions improving)
 *   RECOVERING → CLOSED     (stable for recovery period)
 *   RECOVERING → DEGRADED   (recovered but still unstable)
 *   Any       → CLOSED      (manual reset)
 *
 * @since 6.2.0
 */

// ── Types ──

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN' | 'DEGRADED' | 'RECOVERING'

export interface StateTransition {
  from: CircuitState
  to: CircuitState
  reason: string
  at: number
}

export interface FSMConfig {
  /** How long to stay OPEN before transitioning to HALF_OPEN (ms) */
  openTimeoutMs: number
  /** How many OPEN cycles before DEGRADED */
  degradedAfterN: number
  /** How long to stay in RECOVERING before going CLOSED (ms) */
  recoveryTimeoutMs: number
  /** Max requests allowed in HALF_OPEN state */
  halfOpenMaxRequests: number
}

const DEFAULTS: FSMConfig = {
  openTimeoutMs: 30_000,
  degradedAfterN: 3,
  recoveryTimeoutMs: 60_000,
  halfOpenMaxRequests: 1,
}

// ── Transition Map ──

const TRANSITIONS: Record<CircuitState, CircuitState[]> = {
  CLOSED: ['OPEN'],
  OPEN: ['HALF_OPEN', 'DEGRADED'],
  HALF_OPEN: ['CLOSED', 'OPEN'],
  DEGRADED: ['RECOVERING'],
  RECOVERING: ['CLOSED', 'DEGRADED'],
}

// ── FSM ──

export class CircuitBreakerFSM {
  private _state: CircuitState = 'CLOSED'
  private _transitions: StateTransition[] = []
  private _config: FSMConfig
  private _openCount = 0
  private _halfOpenRequests = 0
  private _lastTransitionAt = Date.now()
  private _recoveryStart = 0

  constructor(config?: Partial<FSMConfig>) {
    this._config = { ...DEFAULTS, ...config }
  }

  // ── Queries ──

  get state(): CircuitState {
    return this._state
  }

  get transitions(): readonly StateTransition[] {
    return this._transitions
  }

  get openCount(): number {
    return this._openCount
  }

  get lastTransitionAt(): number {
    return this._lastTransitionAt
  }

  /** Whether the circuit allows requests to pass through */
  get allowsRequests(): boolean {
    return this._state === 'CLOSED' || this._state === 'HALF_OPEN' || this._state === 'RECOVERING'
  }

  /** Whether the circuit is in a healthy/normal state */
  get isHealthy(): boolean {
    return this._state === 'CLOSED'
  }

  /** Whether the circuit should trigger Safe Mode */
  get needsSafeMode(): boolean {
    return this._state === 'DEGRADED'
  }

  // ── Transitions ──

  /**
   * Attempt a state transition.
   * Throws if the transition is not allowed.
   */
  transition(to: CircuitState, reason: string): void {
    const allowed = TRANSITIONS[this._state]
    if (!allowed.includes(to) && to !== 'CLOSED' && to !== 'DEGRADED') {
      throw new Error(
        `Invalid transition: ${this._state} → ${to}. ` +
        `Allowed from ${this._state}: [${allowed.join(', ')}]`,
      )
    }

    const prev = this._state
    this._state = to
    this._lastTransitionAt = Date.now()

    this._transitions.push({
      from: prev,
      to,
      reason,
      at: this._lastTransitionAt,
    })

    // Track open cycles
    if (to === 'OPEN') {
      this._openCount++
    }

    // Track half-open requests
    if (to === 'HALF_OPEN') {
      this._halfOpenRequests = 0
    }

    // Track recovery start
    if (to === 'RECOVERING') {
      this._recoveryStart = this._lastTransitionAt
    }

    // Reset half-open requests on successful probe
    if (prev === 'HALF_OPEN' && to === 'CLOSED') {
      this._halfOpenRequests = 0
    }
  }

  /**
   * Called when a failure occurs while circuit is CLOSED.
   * Returns true if the circuit should transition to OPEN.
   */
  onFailure(): boolean {
    return false // logic handled by parent CircuitBreaker
  }

  /**
   * Called when cooldown timer expires while circuit is OPEN.
   * Returns true if the circuit should transition to HALF_OPEN.
   */
  onCooldownExpired(): boolean {
    if (this._state !== 'OPEN') return false
    const elapsed = Date.now() - this._lastTransitionAt
    return elapsed >= this._config.openTimeoutMs
  }

  /**
   * Called when HALF_OPEN probe succeeds.
   * Automatically transitions to CLOSED.
   */
  onProbeSuccess(): void {
    if (this._state !== 'HALF_OPEN') {
      throw new Error(`Cannot probe success in state: ${this._state}`)
    }
    this.transition('CLOSED', 'Probe succeeded — circuit closed')
    this._openCount = 0
  }

  /**
   * Called when HALF_OPEN probe fails.
   * Automatically transitions to OPEN (or DEGRADED if threshold exceeded).
   */
  onProbeFailure(): void {
    if (this._state !== 'HALF_OPEN') {
      throw new Error(`Cannot probe failure in state: ${this._state}`)
    }

    if (this._openCount >= this._config.degradedAfterN) {
      this.transition('DEGRADED', `Probe failed — degraded after ${this._openCount} opens`)
    } else {
      this.transition('OPEN', 'Probe failed — circuit re-opened')
    }
  }

  /**
   * Called periodically while in RECOVERING.
   * Automatically transitions to CLOSED if recovery period has elapsed.
   */
  tickRecovery(): void {
    if (this._state !== 'RECOVERING') return
    const elapsed = Date.now() - this._recoveryStart
    if (elapsed >= this._config.recoveryTimeoutMs) {
      this.transition('CLOSED', 'Recovery period elapsed — circuit closed')
      this._openCount = 0
    }
  }

  // ── Manual controls ──

  /** Manually open the circuit (force trigger) */
  forceOpen(reason: string): void {
    this.transition('OPEN', `Manual: ${reason}`)
  }

  /** Manually close the circuit (reset) */
  forceClose(reason: string): void {
    this.transition('CLOSED', `Manual: ${reason}`)
    this._openCount = 0
  }

  /** Manually set degraded */
  forceDegraded(reason: string): void {
    this.transition('DEGRADED', `Manual: ${reason}`)
  }

  /** Reset all state */
  reset(): void {
    this._state = 'CLOSED'
    this._transitions = []
    this._openCount = 0
    this._halfOpenRequests = 0
    this._lastTransitionAt = Date.now()
    this._recoveryStart = 0
  }

  /** Can we attempt a half-open request? */
  canProbe(): boolean {
    if (this._state !== 'HALF_OPEN') return false
    return this._halfOpenRequests < this._config.halfOpenMaxRequests
  }

  /** Record a half-open probe attempt */
  recordProbe(): void {
    this._halfOpenRequests++
  }
}
