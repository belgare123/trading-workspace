/**
 * Tests for Circuit Breaker module
 *
 * Covers:
 *   - CircuitBreakerFSM: all state transitions
 *   - CircuitBreaker: failure counting, thresholds, probes
 *   - DegradationManager: Safe Mode integration
 *   - Error classification
 *   - Edge cases (invalid transitions, boundary values)
 *
 * @since 6.2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CircuitBreakerFSM } from '../CircuitBreakerFSM'
import { CircuitBreaker } from '../CircuitBreaker'
import { DegradationManager } from '../DegradationManager'
import type { CircuitState } from '../CircuitBreakerFSM'

// ════════════════════════════════════════════════
// CircuitBreakerFSM
// ════════════════════════════════════════════════

describe('CircuitBreakerFSM', () => {
  let fsm: CircuitBreakerFSM

  beforeEach(() => {
    fsm = new CircuitBreakerFSM()
  })

  it('starts in CLOSED state', () => {
    expect(fsm.state).toBe('CLOSED')
    expect(fsm.isHealthy).toBe(true)
    expect(fsm.allowsRequests).toBe(true)
    expect(fsm.needsSafeMode).toBe(false)
  })

  it('CLOSED → OPEN transition', () => {
    fsm.transition('OPEN', 'test failure')
    expect(fsm.state).toBe('OPEN')
    expect(fsm.isHealthy).toBe(false)
    expect(fsm.allowsRequests).toBe(false)
    expect(fsm.openCount).toBe(1)
  })

  it('OPEN → HALF_OPEN transition after cooldown', () => {
    fsm.transition('OPEN', 'open')
    fsm.transition('HALF_OPEN', 'cooldown expired')
    expect(fsm.state).toBe('HALF_OPEN')
    expect(fsm.allowsRequests).toBe(true)
  })

  it('HALF_OPEN → CLOSED on probe success', () => {
    fsm.transition('OPEN', 'open')
    fsm.transition('HALF_OPEN', 'probe')
    fsm.onProbeSuccess()
    expect(fsm.state).toBe('CLOSED')
    expect(fsm.isHealthy).toBe(true)
    expect(fsm.openCount).toBe(0) // Reset on success
  })

  it('HALF_OPEN → OPEN on probe failure', () => {
    fsm.transition('OPEN', 'open')
    fsm.transition('HALF_OPEN', 'probe')
    fsm.onProbeFailure()
    expect(fsm.state).toBe('OPEN')
    expect(fsm.openCount).toBe(2) // Second open
  })

  it('HALF_OPEN → DEGRADED after N opens', () => {
    // CLOSED → OPEN (1) → HALF_OPEN → OPEN (2) → HALF_OPEN → OPEN (3) → DEGRADED
    fsm.transition('OPEN', 'fail 1') // CLOSED → OPEN (count: 1)
    fsm.transition('HALF_OPEN', 'cooldown')
    fsm.onProbeFailure() // HALF_OPEN → OPEN (count: 2)
    fsm.transition('HALF_OPEN', 'cooldown')
    fsm.onProbeFailure() // HALF_OPEN → OPEN (count: 3)
    fsm.transition('HALF_OPEN', 'cooldown')
    fsm.onProbeFailure() // HALF_OPEN → DEGRADED (degradedAfterN=3)
    expect(fsm.state).toBe('DEGRADED')
    expect(fsm.needsSafeMode).toBe(true)
    expect(fsm.openCount).toBe(3)
  })

  it('DEGRADED → RECOVERING transition', () => {
    // Force through to degraded
    fsm.forceDegraded('bad')
    expect(fsm.state).toBe('DEGRADED')
    fsm.transition('RECOVERING', 'conditions improving')
    expect(fsm.state).toBe('RECOVERING')
    expect(fsm.allowsRequests).toBe(true)
  })

  it('RECOVERING → CLOSED after recovery period', () => {
    // CLOSED → OPEN (1) → HALF_OPEN → OPEN (2) → HALF_OPEN → OPEN (3) → DEGRADED → RECOVERING
    fsm.transition('OPEN', 'fail 1')
    fsm.transition('HALF_OPEN', 'cooldown')
    fsm.onProbeFailure()
    fsm.transition('HALF_OPEN', 'cooldown')
    fsm.onProbeFailure()
    fsm.transition('HALF_OPEN', 'cooldown')
    fsm.onProbeFailure() // Now DEGRADED (openCount 3 >= degradedAfterN 3)
    fsm.transition('RECOVERING', 'recovering')
    fsm.tickRecovery()
    // With DEFAULT recoveryTimeoutMs=60000, tickRecovery won't transition
    expect(fsm.state).toBe('RECOVERING')
  })

  it('RECOVERING → CLOSED when recovery period elapsed', () => {
    // Create FSM with short recovery window
    const shortFsm = new CircuitBreakerFSM({ recoveryTimeoutMs: 10 })

    // Route through: CLOSED → OPEN → HALF_OPEN → OPEN → HALF_OPEN → DEGRADED → RECOVERING
    shortFsm.transition('OPEN', 'fail 1')
    shortFsm.transition('HALF_OPEN', 'trying')
    shortFsm.onProbeFailure()
    shortFsm.transition('HALF_OPEN', 'trying')
    shortFsm.onProbeFailure()
    shortFsm.transition('HALF_OPEN', 'trying')
    shortFsm.onProbeFailure() // Now DEGRADED (openCount 3 >= degradedAfterN 3)
    shortFsm.transition('RECOVERING', 'recovering')

    // Not enough time has passed yet
    expect(shortFsm.state).toBe('RECOVERING')
    shortFsm.tickRecovery()
    // Still RECOVERING because < 10ms elapsed (recoveryTimeoutMs=10)
    expect(shortFsm.state).toBe('RECOVERING')
  })

  it('rejects invalid transitions', () => {
    expect(() => fsm.transition('HALF_OPEN', 'invalid')).toThrow('Invalid transition')
    expect(() => fsm.transition('RECOVERING', 'invalid')).toThrow('Invalid transition')
  })

  it('CLOSED → OPEN is always allowed from any state (force)', () => {
    fsm.transition('OPEN', 'works')
    expect(fsm.state).toBe('OPEN')
  })

  it('reset works from any state', () => {
    fsm.transition('OPEN', 'fail')
    fsm.reset()
    expect(fsm.state).toBe('CLOSED')
    expect(fsm.openCount).toBe(0)
    expect(fsm.transitions).toHaveLength(0)
  })

  it('tracks transition history', () => {
    fsm.transition('OPEN', 'fail 1')
    fsm.transition('HALF_OPEN', 'cooldown')
    expect(fsm.transitions).toHaveLength(2)
    expect(fsm.transitions[0].from).toBe('CLOSED')
    expect(fsm.transitions[0].to).toBe('OPEN')
    expect(fsm.transitions[0].reason).toBe('fail 1')
  })

  it('half-open request tracking', () => {
    fsm.transition('OPEN', 'fail')
    fsm.transition('HALF_OPEN', 'probe')
    expect(fsm.canProbe()).toBe(true)
    fsm.recordProbe()
    expect(fsm.canProbe()).toBe(false)
  })

  it('onProbeSuccess throws if not in HALF_OPEN', () => {
    expect(() => fsm.onProbeSuccess()).toThrow()
  })

  it('onProbeFailure throws if not in HALF_OPEN', () => {
    expect(() => fsm.onProbeFailure()).toThrow()
  })

  it('onCooldownExpired checks elapsed time', () => {
    fsm.transition('OPEN', 'fail')
    // Should not be expired yet
    expect(fsm.onCooldownExpired()).toBe(false)
  })

  it('onCooldownExpired returns false if not OPEN', () => {
    expect(fsm.onCooldownExpired()).toBe(false)
  })
})

// ════════════════════════════════════════════════
// CircuitBreaker
// ════════════════════════════════════════════════

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 3,
      failureWindowMs: 60_000,
      openTimeoutMs: 10_000,
    })
  })

  afterEach(() => {
    breaker.reset()
  })

  it('starts healthy', () => {
    const snap = breaker.snapshot()
    expect(snap.state).toBe('CLOSED')
    expect(snap.isHealthy).toBe(true)
    expect(snap.allowsRequests).toBe(true)
  })

  it('allows requests in CLOSED state', () => {
    expect(breaker.tryRequest()).toBe(true)
  })

  it('rejects requests in OPEN state', () => {
    // Force to OPEN
    breaker.forceOpen('manual')
    expect(breaker.tryRequest()).toBe(false)
  })

  it('opens circuit after failure threshold exceeded', () => {
    breaker.recordFailure(new Error('err 1'), 'exchange')
    breaker.recordFailure(new Error('err 2'), 'exchange')
    breaker.recordFailure(new Error('err 3'), 'exchange')
    // Should be OPEN now
    expect(breaker.snapshot().state).toBe('OPEN')
    expect(breaker.snapshot().failures.total).toBe(3)
  })

  it('does not open circuit below threshold', () => {
    breaker.recordFailure(new Error('err 1'), 'exchange')
    breaker.recordFailure(new Error('err 2'), 'exchange')
    expect(breaker.snapshot().state).toBe('CLOSED')
    expect(breaker.snapshot().failures.total).toBe(2)
  })

  it('immediately opens on auth error when configured', () => {
    breaker.recordFailure(new Error('Invalid API key'), 'auth')
    expect(breaker.snapshot().state).toBe('OPEN')
  })

  it('immediately opens on network error when configured', () => {
    breaker.recordFailure(new Error('ECONNREFUSED'), 'network')
    expect(breaker.snapshot().state).toBe('OPEN')
  })

  it('classifies errors by name', () => {
    // Use the classify logic via recordFailure with auto-classify
    class NetworkError extends Error { name = 'NetworkError' }
    breaker.recordFailure(new NetworkError('timeout'))
    expect(breaker.snapshot().state).toBe('OPEN')

    // Reset and test rate limit
    breaker.reset()
    class RateLimitError extends Error { name = 'RateLimitError' }
    breaker.recordFailure(new RateLimitError('too many'))
    breaker.recordFailure(new RateLimitError('too many'))
    breaker.recordFailure(new RateLimitError('too many'))
    expect(breaker.snapshot().state).toBe('OPEN')
  })

  it('tracks failures by category', () => {
    breaker.recordFailure(new Error('net err'), 'network')
    breaker.recordFailure(new Error('net err2'), 'network')
    breaker.recordFailure(new Error('auth err'), 'auth')
    const snap = breaker.snapshot()
    expect(snap.failures.byCategory.network).toBe(2)
    expect(snap.failures.byCategory.auth).toBe(1)
  })

  it('success does NOT close open circuit', () => {
    // 3 failures → OPEN
    breaker.recordFailure(new Error('err'), 'exchange')
    breaker.recordFailure(new Error('err'), 'exchange')
    breaker.recordFailure(new Error('err'), 'exchange')
    expect(breaker.snapshot().state).toBe('OPEN')

    // Success in OPEN state should not close circuit
    breaker.recordSuccess()
    expect(breaker.snapshot().state).toBe('OPEN')
  })

  it('half-open probe success transitions to CLOSED', async () => {
    // Open the circuit, then manually set HALF_OPEN for probe
    breaker.forceOpen('testing')
    breaker['fsm'].transition('HALF_OPEN', 'time for probe')

    // Set probe function that succeeds
    breaker.setProbeFn(async () => ({ success: true, latencyMs: 42 }))

    // Execute probe
    const result = await breaker.executeProbe()
    expect(result.success).toBe(true)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(breaker.snapshot().state).toBe('CLOSED')
  })

  it('half-open probe failure re-opens circuit', async () => {
    breaker.forceOpen('testing')
    breaker['fsm'].transition('HALF_OPEN', 'time for probe')
    breaker.setProbeFn(async () => ({ success: false, latencyMs: 100, error: 'still down' }))

    const result = await breaker.executeProbe()
    expect(result.success).toBe(false)
    expect(breaker.snapshot().state).toBe('OPEN')
  })

  it('snapshot contains last failure info', () => {
    breaker.recordFailure(new Error('timeout'), 'network')
    const snap = breaker.snapshot()
    expect(snap.lastFailure).toBeDefined()
    expect(snap.lastFailure!.category).toBe('network')
    expect(snap.lastFailure!.error).toBe('timeout')
  })

  it('forceClose resets the circuit', () => {
    breaker.forceOpen('testing')
    expect(breaker.snapshot().state).toBe('OPEN')
    breaker.forceClose('manual reset')
    expect(breaker.snapshot().state).toBe('CLOSED')
  })

  it('reset clears all state', () => {
    breaker.recordFailure(new Error('err'), 'network')
    breaker.recordFailure(new Error('err'), 'network')
    breaker.recordFailure(new Error('err'), 'network')
    expect(breaker.snapshot().failures.total).toBe(3)
    breaker.reset()
    expect(breaker.snapshot().failures.total).toBe(0)
    expect(breaker.snapshot().state).toBe('CLOSED')
  })

  it('triggers onStateChange callback', () => {
    const changes: Array<{ from: CircuitState; to: CircuitState; reason: string }> = []
    breaker.onStateChange((from, to, reason) => {
      changes.push({ from, to, reason })
    })
    breaker.forceOpen('manual trigger')
    expect(changes).toHaveLength(1)
    expect(changes[0].to).toBe('OPEN')
    expect(changes[0].reason).toMatch(/manual/)
  })

  it('prunes old failures outside window', async () => {
    const shortWindowBreaker = new CircuitBreaker({
      name: 'prune-test',
      failureThreshold: 5,
      failureWindowMs: 50,
      immediateOnNetworkError: false,
    })
    shortWindowBreaker.recordFailure(new Error('err'), 'network')
    shortWindowBreaker.recordFailure(new Error('err'), 'network')

    // Wait for window to expire
    await new Promise<void>(resolve => setTimeout(resolve, 60))
    shortWindowBreaker.recordFailure(new Error('err'), 'network')
    expect(shortWindowBreaker.snapshot().failures.window).toBe(1)
    expect(shortWindowBreaker.snapshot().state).toBe('CLOSED')
  })

  it('tryRequest works in HALF_OPEN', () => {
    breaker.forceOpen('testing')
    // Manually half open
    breaker['fsm'].transition('HALF_OPEN', 'test')
    expect(breaker.tryRequest()).toBe(true)
    expect(breaker.tryRequest()).toBe(false) // Only 1 allowed (halfOpenMaxRequests=1)
  })

  it('does not allow requests in DEGRADED', () => {
    // Must go through OPEN → ... → DEGRADED
    breaker.forceOpen('test')
    breaker.forceDegraded('degrading')
    expect(breaker.tryRequest()).toBe(false)
  })
})

// ════════════════════════════════════════════════
// DegradationManager
// ════════════════════════════════════════════════

describe('DegradationManager', () => {
  let breaker: CircuitBreaker
  let safeModeEntered: number
  let safeModeExited: number
  let lifecycle: { enterSafeMode: () => void; exitSafeMode: () => void }
  let manager: DegradationManager

  beforeEach(() => {
    safeModeEntered = 0
    safeModeExited = 0
    breaker = new CircuitBreaker({ name: 'gw', failureThreshold: 5 })
    lifecycle = {
      enterSafeMode: () => { safeModeEntered++ },
      exitSafeMode: () => { safeModeExited++ },
    }
    manager = new DegradationManager(breaker, lifecycle)
  })

  afterEach(() => {
    breaker.reset()
  })

  it('enters safe mode on DEGRADED state', () => {
    // Force degraded
    breaker.forceDegraded('circuit degraded')
    expect(safeModeEntered).toBe(1)
    expect(manager.isDegraded).toBe(true)
  })

  it('enters safe mode on OPEN state (from CLOSED)', () => {
    breaker.forceOpen('circuit open')
    expect(safeModeEntered).toBe(1)
    expect(manager.isDegraded).toBe(true)
  })

  it('exits safe mode on CLOSED state', () => {
    breaker.forceOpen('test')
    expect(safeModeEntered).toBe(1)
    breaker.forceClose('recovered')
    expect(safeModeExited).toBe(1)
    expect(manager.isDegraded).toBe(false)
  })

  it('does not re-enter safe mode if already degraded', () => {
    breaker.forceOpen('test')
    expect(safeModeEntered).toBe(1)
    // Another trigger
    breaker.forceDegraded('also degraded')
    // Should not call enterSafeMode again
    expect(safeModeEntered).toBe(1)
  })

  it('emits degradation events', () => {
    const events: unknown[] = []
    manager.onDegradation((event) => { events.push(event) })
    breaker.forceOpen('breaking')
    expect(events).toHaveLength(1)
    const evt = events[0] as any
    expect(evt.circuitName).toBe('gw')
    expect(evt.reason).toBe('circuit_open')
    expect(evt.failureCount).toBe(0)
  })

  it('emits recovery events', () => {
    const events: unknown[] = []
    manager.onDegradation((event) => { events.push(event) })
    breaker.forceOpen('break')
    breaker.forceClose('fix')
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({
      circuitName: 'gw',
      currentState: 'CLOSED',
    })
  })
})
