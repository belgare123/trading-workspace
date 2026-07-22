// __tests__/SnapshotHealth.test.ts
// Phase 4.5 — SnapshotHealth report tests

import { describe, it, expect, vi } from 'vitest'
import { SnapshotHealth } from '../SnapshotHealth'
import { SnapshotMetrics } from '../SnapshotMetrics'
import { SnapshotValidator } from '../SnapshotValidator'
import { SnapshotSerializer } from '../SnapshotSerializer'
import type { IEventJournal } from '../IEventJournal'
import type { SnapshotRecord } from '../SnapshotValidator'

function createMockJournal(): IEventJournal {
  const snapshots = new Map<string, SnapshotRecord>()

  return {
    append: vi.fn(),
    flush: vi.fn(),
    rotate: vi.fn(),
    recover: vi.fn(),
    read: vi.fn(),
    getCurrentSequence: vi.fn().mockReturnValue(0),
    close: vi.fn(),

    checkpoint: vi.fn(),
    saveSnapshot: vi.fn().mockImplementation((s: SnapshotRecord) => {
      snapshots.set(s.aggregate_id, s)
    }),
    loadSnapshot: vi.fn().mockImplementation((id: string) => {
      return snapshots.get(id) ?? null
    }),
    listAggregateIds: vi.fn().mockImplementation(() => Array.from(snapshots.keys())),
    pruneSnapshots: vi.fn(),
    getLastAppliedSequence: vi.fn().mockImplementation(() => {
      let max = 0
      for (const snap of snapshots.values()) {
        if (snap.sequence > max) max = snap.sequence
      }
      return max
    }),
  }
}

function makeSnapshot(overrides: Partial<SnapshotRecord> = {}): SnapshotRecord {
  return {
    snapshot_id: 'ss-1',
    aggregate_id: 'trade',
    sequence: 100,
    snapshot_version: 2,
    checksum: null,
    last_applied_sequence: 100,
    created_at: Date.now() - 1000, // 1 second ago
    payload: JSON.stringify({ balance: 1000 }),
    ...overrides,
  }
}

describe('SnapshotHealth', () => {
  it('reports healthy when snapshots exist', () => {
    const journal = createMockJournal()
    journal.saveSnapshot(makeSnapshot({ aggregate_id: 'trade', sequence: 100 }))
    journal.saveSnapshot(makeSnapshot({ aggregate_id: 'wallet', sequence: 50 }))

    const health = new SnapshotHealth(journal)
    const report = health.report()

    expect(report.healthy).toBe(true)
    expect(report.snapshotCount).toBe(2)
    expect(report.lastSnapshotSequence).toBe(100)
    expect(report.validation).toBe('ok')
  })

  it('warns when no snapshots exist', () => {
    const journal = createMockJournal()
    const health = new SnapshotHealth(journal)
    const report = health.report()

    expect(report.snapshotCount).toBe(0)
    expect(report.healthy).toBe(true) // no errors, just warning
    expect(report.validation).toBe('warning')
    expect(report.warnings.some(w => w.includes('No snapshots'))).toBe(true)
  })

  it('includes metrics when provided', () => {
    const journal = createMockJournal()
    journal.saveSnapshot(makeSnapshot())

    const metrics = new SnapshotMetrics()
    metrics.incCreateTotal('high')

    const health = new SnapshotHealth(journal, metrics)
    const report = health.report()

    expect(report.metrics.createTotal).toBe(1)
  })

  it('reports errors when validator fails', () => {
    const journal = createMockJournal()
    journal.saveSnapshot(makeSnapshot({
      aggregate_id: '',
      checksum: 'bad',
    }))

    const validator = new SnapshotValidator(new SnapshotSerializer())
    const health = new SnapshotHealth(journal, undefined, validator)
    const report = health.report()

    expect(report.healthy).toBe(false)
    expect(report.validation).toBe('error')
    expect(report.errors.length).toBeGreaterThan(0)
  })

  it('warns on stale snapshots (older than 1 hour)', () => {
    const journal = createMockJournal()
    journal.saveSnapshot(makeSnapshot({
      created_at: Date.now() - 3_700_000, // ~61 min ago
    }))

    const health = new SnapshotHealth(journal)
    const report = health.report()

    expect(report.lastSnapshotAge).toBeGreaterThan(3_600_000)
    expect(report.warnings.some(w => w.includes('old'))).toBe(true)
    expect(report.validation).toBe('warning')
  })

  it('warns but does not error for stale snapshots plus no snapshot', () => {
    const journal = createMockJournal()
    const health = new SnapshotHealth(journal)
    const report = health.report()

    // No snapshots = warning, not error
    expect(report.healthy).toBe(true)
    expect(report.errors).toHaveLength(0)
  })
})
