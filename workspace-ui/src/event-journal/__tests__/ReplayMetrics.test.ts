// __tests__/ReplayMetrics.test.ts
// Phase 5 — ReplayMetrics unit tests

import { describe, it, expect } from 'vitest'
import { ReplayMetrics, NOOP_REPLAY_METRICS } from '../ReplayMetrics'

describe('ReplayMetrics', () => {
  it('starts with zero state', () => {
    const m = new ReplayMetrics()
    const s = m.snapshot()
    expect(s.eventsReplayedTotal).toBe(0)
    expect(s.eventsSkippedTotal).toBe(0)
    expect(s.eventsFailedTotal).toBe(0)
    expect(s.batchesProcessed).toBe(0)
    expect(s.totalReplayDurationMs).toBe(0)
  })

  it('tracks replayed events', () => {
    const m = new ReplayMetrics()
    m.incEventsReplayed(3)
    m.incEventsReplayed(5)
    expect(m.snapshot().eventsReplayedTotal).toBe(8)
  })

  it('tracks skipped events', () => {
    const m = new ReplayMetrics()
    m.incEventsSkipped(2)
    expect(m.snapshot().eventsSkippedTotal).toBe(2)
  })

  it('tracks failed events', () => {
    const m = new ReplayMetrics()
    m.incEventsFailed(1)
    expect(m.snapshot().eventsFailedTotal).toBe(1)
  })

  it('tracks batch timing', () => {
    const m = new ReplayMetrics()
    m.startBatch()
    m.endBatch(10)
    expect(m.snapshot().batchesProcessed).toBe(1)
  })

  it('tracks replay duration', () => {
    const m = new ReplayMetrics()
    m.startReplay()
    // Just observe a duration directly
    m.observeReplayDuration(500)
    expect(m.snapshot().totalReplayDurationMs).toBe(500)
  })

  it('calculates event rate from wall clock', () => {
    const m = new ReplayMetrics()
    m.startReplay()
    m.incEventsReplayed(100)
    m.observeReplayDuration(2000)
    const s = m.snapshot()
    // eventRate = events / (Date.now() - lastResetAt) * 1000
    // Actual value depends on real time, just verify it's computed
    expect(s.eventRate).toBeGreaterThanOrEqual(0)
    expect(s.totalReplayDurationMs).toBe(2000)
  })

  it('resets correctly', () => {
    const m = new ReplayMetrics()
    m.incEventsReplayed(10)
    m.startBatch()
    m.endBatch(5)
    m.reset()
    const s = m.snapshot()
    expect(s.eventsReplayedTotal).toBe(0)
    expect(s.batchesProcessed).toBe(0)
  })

  it('NOOP has all methods', () => {
    expect(() => NOOP_REPLAY_METRICS.incEventsReplayed(1)).not.toThrow()
    expect(() => NOOP_REPLAY_METRICS.startReplay()).not.toThrow()
    expect(() => NOOP_REPLAY_METRICS.startBatch()).not.toThrow()
    expect(() => NOOP_REPLAY_METRICS.endBatch(5)).not.toThrow()
    expect(() => NOOP_REPLAY_METRICS.snapshot()).not.toThrow()
    expect(() => NOOP_REPLAY_METRICS.reset()).not.toThrow()
  })
})
