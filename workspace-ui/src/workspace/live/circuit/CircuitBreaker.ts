/**
 * CircuitBreaker — Production circuit breaker for exchange connectivity.
 *
 * Monitors broker errors, tracks failure counts per error category,
 * and transitions through CircuitBreakerFSM states. Integrates with:
 *   - LifecycleManager (Safe Mode on DEGRADED)
 *   - ObservabilityRuntime (metrics + alerts)
 *   - HealthAggregator (circuit health as module)
 *
 * Error categories treated differently:
 *   NetworkError   → immediate open (fast recovery)
 *   RateLimitError → count-based open (backoff)
 *   AuthError      → immediate open + no auto-recovery
 *   TimeoutError   → count-based open
 *   ExchangeError  → count-based open (HTTP 5xx, exchange codes)
 *   ValidationError→ does NOT open circuit (client-side error)
 *
 * @since 6.2.0
 */

import { CircuitBreakerFSM, type CircuitState } from './CircuitBreakerFSM'

// ── Types ──

export type ErrorCategory =
  | 'network'
  | 'rate_limit'
  | 'auth'
  | 'timeout'
  | 'exchange'
  | 'validation'
  | 'unknown'

export interface CircuitBreakerConfig {
  /** Name/identifier for this circuit */
  name: string
  /** Max failures in CLOSED state before opening */
  failureThreshold: number
  /** Count only within this window (ms). 0 = total count. */
  failureWindowMs: number
  /** How long to stay OPEN (ms) */
  openTimeoutMs: number
  /** How many OPEN cycles before DEGRADED */
  degradedAfterN: number
  /** Recovery period before CLOSED (ms) */
  recoveryTimeoutMs: number
  /** Max requests allowed in HALF_OPEN state */
  halfOpenMaxRequests: number
  /** Whether to open circuit immediately on NetworkError */
  immediateOnNetworkError: boolean
  /** Whether to open circuit immediately on AuthError */
  immediateOnAuthError: boolean
  /** Callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState, reason: string) => void
}

const DEFAULTS: CircuitBreakerConfig = {
  name: 'default',
  failureThreshold: 5,
  failureWindowMs: 60_000, // 1 minute sliding window
  openTimeoutMs: 30_000,
  degradedAfterN: 3,
  recoveryTimeoutMs: 60_000,
  halfOpenMaxRequests: 1,
  immediateOnNetworkError: true,
  immediateOnAuthError: true,
}

// ── Failure Record ──

interface FailureRecord {
  category: ErrorCategory
  at: number
  error: string
}

// ── Probe Result ──

export interface ProbeResult {
  success: boolean
  latencyMs: number
  error?: string
}

// ── Circuit Breaker Snapshot ──

export interface CircuitBreakerSnapshot {
  name: string
  state: CircuitState
  allowsRequests: boolean
  isHealthy: boolean
  needsSafeMode: boolean
  failures: {
    total: number
    window: number
    byCategory: Record<ErrorCategory, number>
  }
  openCount: number
  uptimeMs: number
  lastFailure?: { category: ErrorCategory; error: string; at: number }
  lastTransition?: { from: CircuitState; to: CircuitState; reason: string; at: number }
}

// ── Circuit Breaker ──

export class CircuitBreaker {
  readonly fsm: CircuitBreakerFSM
  private _config: CircuitBreakerConfig
  private _failures: FailureRecord[] = []
  private _startedAt = Date.now()
  private _probeFn: (() => Promise<ProbeResult>) | null = null
  private _cooldownTimer: ReturnType<typeof setTimeout> | null = null
  private _recoveryTimer: ReturnType<typeof setInterval> | null = null

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this._config = { ...DEFAULTS, ...config }
    this.fsm = new CircuitBreakerFSM({
      openTimeoutMs: this._config.openTimeoutMs,
      degradedAfterN: this._config.degradedAfterN,
      recoveryTimeoutMs: this._config.recoveryTimeoutMs,
      halfOpenMaxRequests: this._config.halfOpenMaxRequests,
    })
  }

  // ── Configuration ──

  get name(): string {
    return this._config.name
  }

  /** Set the probe function used in HALF_OPEN state */
  setProbeFn(fn: () => Promise<ProbeResult>): void {
    this._probeFn = fn
  }

  /** Register a custom onStateChange handler */
  onStateChange(fn: (from: CircuitState, to: CircuitState, reason: string) => void): void {
    this._config.onStateChange = fn
  }

  // ── Core Logic ──

  /**
   * Record a success. Resets the failure window.
   * If in HALF_OPEN, transitions to CLOSED.
   * If in RECOVERING, helps the recovery timer.
   */
  recordSuccess(): void {
    // Clear failure window on success
    this._failures = this._failures.filter(f => this._isInWindow(f))

    const state = this.fsm.state

    if (state === 'HALF_OPEN') {
      if (this.fsm.canProbe()) {
        this.fsm.recordProbe()
        this.fsm.onProbeSuccess()
        this._notifyChange('HALF_OPEN', 'CLOSED', 'Success in half-open state')
        this._cancelTimers()
      }
    }

    if (state === 'RECOVERING') {
      this.fsm.tickRecovery()
    }
  }

  /**
   * Record a failure. Classifies the error, updates counters,
   * and potentially transitions the FSM.
   */
  recordFailure(error: Error, category?: ErrorCategory): void {
    const cat = category ?? this._classifyError(error)
    const record: FailureRecord = {
      category: cat,
      at: Date.now(),
      error: error.message,
    }

    this._failures.push(record)

    // Prune old failures outside window
    this._pruneFailures()

    const state = this.fsm.state
    const windowCount = this._windowFailureCount()

    // ── Immediate open conditions ──
    if (state === 'CLOSED') {
      if (
        (cat === 'auth' && this._config.immediateOnAuthError) ||
        (cat === 'network' && this._config.immediateOnNetworkError)
      ) {
        this._openCircuit(`Immediate open on ${cat}: ${error.message}`)
        return
      }

      if (windowCount >= this._config.failureThreshold) {
        this._openCircuit(`Threshold reached: ${windowCount}/${this._config.failureThreshold} failures in window`)
        return
      }
    }

    // ── Half-open probe failure ──
    if (state === 'HALF_OPEN') {
      this.fsm.onProbeFailure()
      this._notifyChange('HALF_OPEN', this.fsm.state, `Probe failed: ${error.message}`)
      this._startCooldownTimer()
      return
    }
  }

  /**
   * Attempt a request through the circuit.
   * If circuit is OPEN, returns null (fail-fast).
   * If circuit is HALF_OPEN, tracks probe count.
   *
   * Usage:
   *   const allowed = breaker.tryRequest()
   *   if (!allowed) { /* fail fast * / }
   */
  tryRequest(): boolean {
    const state = this.fsm.state

    // Fast-fail on OPEN
    if (state === 'OPEN') return false
    if (state === 'DEGRADED') return false

    // Track half-open probes
    if (state === 'HALF_OPEN') {
      if (!this.fsm.canProbe()) return false
      this.fsm.recordProbe()
    }

    return true
  }

  // ── Probe Execution ──

  /**
   * Execute the probe function (if set) to check exchange health.
   * Called automatically when circuit enters HALF_OPEN.
   */
  async executeProbe(): Promise<ProbeResult> {
    if (!this._probeFn) {
      return { success: false, latencyMs: 0, error: 'No probe function configured' }
    }

    const start = performance.now()
    try {
      const result = await this._probeFn()
      const latencyMs = performance.now() - start
      if (result.success) {
        this.recordSuccess()
        return { success: true, latencyMs }
      } else {
        this.recordFailure(new Error(result.error ?? 'Probe failed'))
        return { success: false, latencyMs, error: result.error }
      }
    } catch (err) {
      const latencyMs = performance.now() - start
      this.recordFailure(err as Error)
      return { success: false, latencyMs, error: (err as Error).message }
    }
  }

  // ── Snapshot ──

  /**
   * Get a snapshot of current breaker state for metrics/health.
   */
  snapshot(): CircuitBreakerSnapshot {
    const failures = this._failures
    const byCategory: Record<ErrorCategory, number> = {
      network: 0,
      rate_limit: 0,
      auth: 0,
      timeout: 0,
      exchange: 0,
      validation: 0,
      unknown: 0,
    }
    for (const f of failures) {
      byCategory[f.category] = (byCategory[f.category] ?? 0) + 1
    }

    const transitions = this.fsm.transitions
    const lastTransition = transitions.length > 0 ? transitions[transitions.length - 1] : undefined
    const lastFailure = failures.length > 0 ? failures[failures.length - 1] : undefined

    return {
      name: this._config.name,
      state: this.fsm.state,
      allowsRequests: this.fsm.allowsRequests,
      isHealthy: this.fsm.isHealthy,
      needsSafeMode: this.fsm.needsSafeMode,
      failures: {
        total: failures.length,
        window: this._windowFailureCount(),
        byCategory,
      },
      openCount: this.fsm.openCount,
      uptimeMs: Date.now() - this._startedAt,
      lastFailure: lastFailure
        ? { category: lastFailure.category, error: lastFailure.error, at: lastFailure.at }
        : undefined,
      lastTransition: lastTransition
        ? { from: lastTransition.from, to: lastTransition.to, reason: lastTransition.reason, at: lastTransition.at }
        : undefined,
    }
  }

  // ── Manual Controls ──

  forceOpen(reason: string): void {
    const prev = this.fsm.state
    this.fsm.forceOpen(reason)
    this._notifyChange(prev, 'OPEN', reason)
    this._startCooldownTimer()
  }

  forceClose(reason: string): void {
    const prev = this.fsm.state
    this._cancelTimers()
    this.fsm.forceClose(reason)
    this._notifyChange(prev, 'CLOSED', reason)
  }

  forceDegraded(reason: string): void {
    const prev = this.fsm.state
    this._cancelTimers()
    this.fsm.forceDegraded(reason)
    this._notifyChange(prev, 'DEGRADED', reason)
  }

  reset(): void {
    this._cancelTimers()
    this._failures = []
    this.fsm.reset()
    this._startedAt = Date.now()
  }

  // ── Private ──

  private _openCircuit(reason: string): void {
    const prevState = this.fsm.state
    this.fsm.transition('OPEN', reason)
    this._notifyChange(prevState, 'OPEN', reason)
    this._startCooldownTimer()
  }

  private _notifyChange(from: CircuitState, to: CircuitState, reason: string): void {
    this._config.onStateChange?.(from, to, reason)
  }

  /** Start the cooldown timer for OPEN → HALF_OPEN transition */
  private _startCooldownTimer(): void {
    this._cancelTimers()
    this._cooldownTimer = setTimeout(() => {
      if (this.fsm.state === 'OPEN') {
        this.fsm.transition('HALF_OPEN', 'Cooldown expired')
        this._notifyChange('OPEN', 'HALF_OPEN', 'Cooldown expired')

        // Execute probe automatically
        this.executeProbe()
      }
    }, this._config.openTimeoutMs)
  }

  private _cancelTimers(): void {
    if (this._cooldownTimer) {
      clearTimeout(this._cooldownTimer)
      this._cooldownTimer = null
    }
    if (this._recoveryTimer) {
      clearInterval(this._recoveryTimer)
      this._recoveryTimer = null
    }
  }

  private _classifyError(error: Error): ErrorCategory {
    const name = error.name ?? error.constructor?.name ?? ''
    const message = error.message ?? ''

    if (name.includes('NetworkError') || message.match(/network|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|DNS/i)) return 'network'
    if (name.includes('RateLimitError') || message.match(/rate.limit|429|too many requests/i)) return 'rate_limit'
    if (name.includes('TimeoutError') || name.includes('Timeout') || message.match(/timeout|timed.out/i)) return 'timeout'
    if (name.includes('AuthenticationError') || name.includes('AuthError') || message.match(/auth|api.key|api.secret|403|401/i)) return 'auth'
    if (name.includes('ExchangeRejectedError') || name.includes('ExchangeUnavailableError') || message.match(/5\d\d|exchange.*unavail|maintenance|10006|10016|10001/i)) return 'exchange'
    if (name.includes('ValidationError') || message.match(/invalid|validation/i)) return 'validation'
    return 'unknown'
  }

  private _isInWindow(record: FailureRecord): boolean {
    if (this._config.failureWindowMs <= 0) return true
    return Date.now() - record.at < this._config.failureWindowMs
  }

  private _windowFailureCount(): number {
    return this._failures.filter(f => this._isInWindow(f)).length
  }

  private _pruneFailures(): void {
    if (this._config.failureWindowMs <= 0) return
    const cutoff = Date.now() - this._config.failureWindowMs
    this._failures = this._failures.filter(f => f.at > cutoff)
  }
}
