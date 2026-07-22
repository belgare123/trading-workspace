// __tests__/SnapshotMetrics.test.ts
// Phase 4.4 — SnapshotMetrics collector tests

import { describe, it, expect } from 'vitest'
import { SnapshotMetrics } from '../SnapshotMetrics'

describe('SnapshotMetrics', () => {
  it('starts at zero', () => {
    const m = new SnapshotMetrics()
    expect(m.createTotal).toBe(0)
    expect(m.restoreTotal).toBe(0)
    expect(m.validationFailedTotal).toBe(0)
    expect(m.prunedTotal).toBe(0)
  })

  it('tracks create totals by priority', () => {
    const m = new SnapshotMetrics()
    m.incCreateTotal('medium')
    m.incCreateTotal('high')
    m.incCreateTotal('medium')

    const snap = m.snapshot()
    expect(snap.createTotal).toBe(3)
    expect(snap.createTotalByPriority['medium']).toBe(2)
    expect(snap.createTotalByPriority['high']).toBe(1)
  })

  it('tracks restore totals by source', () => {
    const m = new SnapshotMetrics()
    m.incRestoreTotal('latest')
    m.incRestoreTotal('aggregate')
    m.incRestoreTotal('latest')

    const snap = m.snapshot()
    expect(snap.restoreTotal).toBe(3)
    expect(snap.restoreTotalBySource['latest']).toBe(2)
    expect(snap.restoreTotalBySource['aggregate']).toBe(1)
  })

  it('tracks validation failures by reason', () => {
    const m = new SnapshotMetrics()
    m.incValidationFailed('checksum')
    m.incValidationFailed('version')
    m.incValidationFailed('checksum')

    const snap = m.snapshot()
    expect(snap.validationFailedTotal).toBe(3)
    expect(snap.validationFailedByReason['checksum']).toBe(2)
    expect(snap.validationFailedByReason['version']).toBe(1)
  })

  it('tracks prune totals', () => {
    const m = new SnapshotMetrics()
    m.incPrunedTotal(10)
    m.incPrunedTotal(5)
    expect(m.prunedTotal).toBe(15)
  })

  it('observes duration and size histograms', () => {
    const m = new SnapshotMetrics()
    m.observeDuration(100)
    m.observeDuration(200)
    m.observeDuration(300)
    m.observeSizeBytes(1024)
    m.observeSizeBytes(2048)

    const snap = m.snapshot()
    expect(snap.durationMs).toHaveLength(3)
    expect(snap.sizeBytes).toHaveLength(2)
  })

  it('computes averages', () => {
    const m = new SnapshotMetrics()
    m.observeDuration(10)
    m.observeDuration(20)
    m.observeDuration(30)
    m.observeDuration(40)

    expect(m.avgDurationMs).toBe(25)
    expect(m.p50DurationMs).toBe(25)
    expect(m.p99DurationMs).toBe(40) // highest value in a 4-element set
  })

  it('reset clears all', () => {
    const m = new SnapshotMetrics()
    m.incCreateTotal('high')
    m.observeDuration(500)
    m.reset()

    const snap = m.snapshot()
    expect(snap.createTotal).toBe(0)
    expect(snap.durationMs).toHaveLength(0)
  })

  it('caps observations at maxObservations', () => {
    const m = new SnapshotMetrics()
    for (let i = 0; i < 1100; i++) {
      m.observeDuration(i)
    }
    expect(m.snapshot().durationMs).toHaveLength(1000)
  })
})
