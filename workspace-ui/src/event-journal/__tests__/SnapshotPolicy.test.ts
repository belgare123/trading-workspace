// __tests__/SnapshotPolicy.test.ts
// Phase 4.1 — SnapshotPolicy deterministic decision tests

import { describe, it, expect, vi } from 'vitest'
import { SnapshotPolicy, DEFAULT_SNAPSHOT_POLICY } from '../SnapshotPolicy'
import type { SnapshotContext } from '../SnapshotPolicy'

function makeCtx(overrides: Partial<SnapshotContext> = {}): SnapshotContext {
  return {
    currentSequence: 500,
    lastSnapshotSequence: 400,
    lastSnapshotTimestamp: Date.now() - 10_000,
    eventsSinceSnapshot: 10,
    activeTradeIds: [],
    activePositionIds: [],
    dirtyRuntimes: [],
    isShuttingDown: false,
    isEmergencyStop: false,
    isTradeClosed: false,
    isPositionChanged: false,
    ...overrides,
  }
}

describe('SnapshotPolicy', () => {
  it('returns shouldSnapshot=false for clean state', () => {
    const policy = new SnapshotPolicy()
    const decision = policy.shouldSnapshot(makeCtx())
    expect(decision.shouldSnapshot).toBe(false)
    expect(decision.priority).toBe('low')
  })

  it('triggers on emergency stop with critical priority', () => {
    const policy = new SnapshotPolicy()
    const decision = policy.shouldSnapshot(makeCtx({ isEmergencyStop: true }))
    expect(decision.shouldSnapshot).toBe(true)
    expect(decision.priority).toBe('critical')
    expect(decision.reason).toContain('Emergency')
  })

  it('triggers on shutdown with critical priority', () => {
    const policy = new SnapshotPolicy()
    const decision = policy.shouldSnapshot(makeCtx({ isShuttingDown: true }))
    expect(decision.shouldSnapshot).toBe(true)
    expect(decision.priority).toBe('critical')
    expect(decision.reason).toContain('shutting down')
  })

  it('triggers on trade close with high priority', () => {
    const policy = new SnapshotPolicy()
    const decision = policy.shouldSnapshot(makeCtx({ isTradeClosed: true }))
    expect(decision.shouldSnapshot).toBe(true)
    expect(decision.priority).toBe('high')
    expect(decision.reason).toContain('Trade closed')
  })

  it('triggers on position change with high priority', () => {
    const policy = new SnapshotPolicy()
    const decision = policy.shouldSnapshot(makeCtx({ isPositionChanged: true }))
    expect(decision.shouldSnapshot).toBe(true)
    expect(decision.priority).toBe('high')
    expect(decision.reason).toContain('Position changed')
  })

  it('triggers on dirty runtimes with high priority', () => {
    const policy = new SnapshotPolicy()
    const decision = policy.shouldSnapshot(makeCtx({ dirtyRuntimes: ['wallet'] }))
    expect(decision.shouldSnapshot).toBe(true)
    expect(decision.priority).toBe('high')
    expect(decision.reason).toContain('wallet')
  })

  it('triggers on event threshold with medium priority', () => {
    const policy = new SnapshotPolicy({ maxEventsBeforeSnapshot: 10 })
    const decision = policy.shouldSnapshot(makeCtx({ eventsSinceSnapshot: 10 }))
    expect(decision.shouldSnapshot).toBe(true)
    expect(decision.priority).toBe('medium')
    expect(decision.reason).toContain('events')
  })

  it('triggers on timer interval with medium priority', () => {
    const policy = new SnapshotPolicy({ maxIntervalMs: 5000 })
    const decision = policy.shouldSnapshot(
      makeCtx({ lastSnapshotTimestamp: Date.now() - 10_000 }),
    )
    expect(decision.shouldSnapshot).toBe(true)
    expect(decision.priority).toBe('medium')
    expect(decision.reason).toContain('since last snapshot')
  })

  it('respects first-use: no timer trigger on zero timestamp', () => {
    const policy = new SnapshotPolicy({ maxIntervalMs: 1 })
    const decision = policy.shouldSnapshot(makeCtx({ lastSnapshotTimestamp: 0 }))
    expect(decision.shouldSnapshot).toBe(false)
  })

  it('event threshold overrides timer when both are close', () => {
    const policy = new SnapshotPolicy({ maxEventsBeforeSnapshot: 5 })
    const decision = policy.shouldSnapshot(
      makeCtx({ eventsSinceSnapshot: 5, lastSnapshotTimestamp: Date.now() - 1000 }),
    )
    expect(decision.shouldSnapshot).toBe(true)
    expect(decision.reason).toContain('events')
  })

  it('can disable individual triggers via config', () => {
    const policy = new SnapshotPolicy({
      snapshotOnTradeClose: false,
      snapshotOnPositionChange: false,
      snapshotOnShutdown: false,
      snapshotOnEmergencyStop: false,
      snapshotOnDirtyState: false,
    })
    // Even with all signals on, none should trigger
    const decision = policy.shouldSnapshot(makeCtx({
      isEmergencyStop: true,
      isShuttingDown: true,
      isTradeClosed: true,
      isPositionChanged: true,
      dirtyRuntimes: ['risk'],
    }))
    // Without event/timer triggers, should be false
    expect(decision.shouldSnapshot).toBe(false)
    expect(decision.priority).toBe('low')
  })

  it('critical priority takes precedence over high', () => {
    const policy = new SnapshotPolicy()
    const decision = policy.shouldSnapshot(makeCtx({
      isShuttingDown: true,
      isTradeClosed: true,
    }))
    expect(decision.shouldSnapshot).toBe(true)
    // Shutdown checked first → critical
    expect(decision.priority).toBe('critical')
    expect(decision.reason).toContain('shutting down')
  })

  it('high priority takes precedence over medium', () => {
    const policy = new SnapshotPolicy({ maxEventsBeforeSnapshot: 5 })
    const decision = policy.shouldSnapshot(makeCtx({
      eventsSinceSnapshot: 5,
      isTradeClosed: true,
    }))
    expect(decision.priority).toBe('high')
    expect(decision.reason).toContain('Trade closed')
  })

  it('is deterministic — same context always same decision', () => {
    const policy = new SnapshotPolicy()
    const ctx = makeCtx({ isPositionChanged: true })
    const d1 = policy.shouldSnapshot(ctx)
    const d2 = policy.shouldSnapshot(ctx)
    expect(d1).toEqual(d2)
  })
})
