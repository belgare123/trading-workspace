// ── LifecycleManager FSM tests ──

import { describe, it, expect } from 'vitest'
import { LifecycleManager, InvalidTransitionError } from '../LifecycleManager'
import { LIFECYCLE_STATES } from '../types'

describe('LifecycleManager', () => {
  it('starts in CREATED state', () => {
    const lm = new LifecycleManager()
    expect(lm.state).toBe(LIFECYCLE_STATES.CREATED)
    expect(lm.isRunning).toBe(false)
    expect(lm.isStopped).toBe(false)
    expect(lm.uptimeMs).toBe(0)
  })

  it('transitions CREATED → INITIALIZING on init()', () => {
    const lm = new LifecycleManager()
    lm.init()
    expect(lm.state).toBe(LIFECYCLE_STATES.INITIALIZING)
  })

  it('transitions INITIALIZING → RECOVERING on startRecovery()', () => {
    const lm = new LifecycleManager()
    lm.init()
    lm.startRecovery()
    expect(lm.state).toBe(LIFECYCLE_STATES.RECOVERING)
  })

  it('transitions RECOVERING → RUNNING on completeRecovery() with healthy report', () => {
    const lm = new LifecycleManager()
    lm.init()
    lm.startRecovery()
    lm.completeRecovery({
      recoveredTrades: 0,
      recoveredOrders: 0,
      recoveredPositions: 0,
      warnings: [],
      errors: [],
      durationMs: 100,
      healthy: true,
    })
    expect(lm.state).toBe(LIFECYCLE_STATES.RUNNING)
    expect(lm.isRunning).toBe(true)
    expect(lm.uptimeMs).toBeGreaterThanOrEqual(0)
    expect(lm['_startTime']).toBeGreaterThan(0) // _startTime was set
    expect(lm.lastRecoveryReport?.healthy).toBe(true)
  })

  it('transitions RECOVERING → DEGRADED on completeRecovery() with unhealthy report', () => {
    const lm = new LifecycleManager()
    lm.init()
    lm.startRecovery()
    lm.completeRecovery({
      recoveredTrades: 0,
      recoveredOrders: 0,
      recoveredPositions: 0,
      warnings: ['Some issue'],
      errors: ['Critical error'],
      durationMs: 100,
      healthy: false,
    })
    expect(lm.state).toBe(LIFECYCLE_STATES.DEGRADED)
    expect(lm.isRunning).toBe(false)
    expect(lm.lastRecoveryReport?.healthy).toBe(false)
  })

  it('transitions DEGRADED → RUNNING on recover()', () => {
    const lm = new LifecycleManager()
    lm.init()
    lm.startRecovery()
    lm.completeRecovery({
      recoveredTrades: 0,
      recoveredOrders: 0,
      recoveredPositions: 0,
      warnings: ['warn'],
      errors: ['err'],
      durationMs: 100,
      healthy: false,
    })
    expect(lm.state).toBe(LIFECYCLE_STATES.DEGRADED)

    lm.recover()
    expect(lm.state).toBe(LIFECYCLE_STATES.RUNNING)
    expect(lm.isRunning).toBe(true)
  })

  it('transitions RUNNING → DEGRADED on degrade()', () => {
    const lm = new LifecycleManager()
    lm.init()
    lm.startRecovery()
    lm.completeRecovery({ recoveredTrades: 0, recoveredOrders: 0, recoveredPositions: 0, warnings: [], errors: [], durationMs: 0, healthy: true })
    expect(lm.state).toBe(LIFECYCLE_STATES.RUNNING)

    lm.degrade(new Error('Connection lost'))
    expect(lm.state).toBe(LIFECYCLE_STATES.DEGRADED)
    expect(lm.error?.message).toBe('Connection lost')
  })

  it('transitions RUNNING → STOPPING → STOPPED on stop() + finalize()', () => {
    const lm = new LifecycleManager()
    lm.init()
    lm.startRecovery()
    lm.completeRecovery({ recoveredTrades: 0, recoveredOrders: 0, recoveredPositions: 0, warnings: [], errors: [], durationMs: 0, healthy: true })

    lm.stop()
    expect(lm.state).toBe(LIFECYCLE_STATES.STOPPING)

    lm.finalize()
    expect(lm.state).toBe(LIFECYCLE_STATES.STOPPED)
    expect(lm.isStopped).toBe(true)
  })

  it('throws InvalidTransitionError on invalid transitions', () => {
    const lm = new LifecycleManager()
    // Cannot go from CREATED directly to RUNNING
    expect(() => lm['assertTransition'](LIFECYCLE_STATES.RUNNING)).toThrow()
  })

  it('fires state entered/exited events', () => {
    const lm = new LifecycleManager()
    const events: string[] = []

    lm.on((event, state) => {
      events.push(`${event}:${state}`)
    })

    lm.init()
    lm.startRecovery()
    lm.completeRecovery({ recoveredTrades: 0, recoveredOrders: 0, recoveredPositions: 0, warnings: [], errors: [], durationMs: 0, healthy: true })

    expect(events).toContain('state:exited:CREATED')
    expect(events).toContain('state:entered:INITIALIZING')
    expect(events).toContain('state:exited:INITIALIZING')
    expect(events).toContain('state:entered:RECOVERING')
    expect(events).toContain('state:entered:RUNNING')
  })

  it('full happy path lifecycle', () => {
    const lm = new LifecycleManager()

    expect(lm.state).toBe('CREATED')
    lm.init()
    expect(lm.state).toBe('INITIALIZING')
    lm.startRecovery()
    expect(lm.state).toBe('RECOVERING')
    lm.completeRecovery({ recoveredTrades: 3, recoveredOrders: 2, recoveredPositions: 1, warnings: [], errors: [], durationMs: 500, healthy: true })
    expect(lm.state).toBe('RUNNING')
    expect(lm.lastRecoveryReport?.recoveredTrades).toBe(3)
    expect(lm.lastRecoveryReport?.recoveredOrders).toBe(2)
    expect(lm.lastRecoveryReport?.recoveredPositions).toBe(1)
    expect(lm.lastRecoveryReport?.durationMs).toBe(500)

    lm.stop()
    expect(lm.state).toBe('STOPPING')
    lm.finalize()
    expect(lm.state).toBe('STOPPED')
  })
})
