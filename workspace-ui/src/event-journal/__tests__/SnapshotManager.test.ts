// __tests__/SnapshotManager.test.ts
// Phase 4.2 — SnapshotManager orchestrator tests

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SnapshotManager } from '../SnapshotManager'
import type { SnapshotMetricsCollector, AggregateSnapshotInput } from '../SnapshotManager'
import type { IEventJournal, SnapshotRecord } from '../IEventJournal'
import { SnapshotPolicy } from '../SnapshotPolicy'
import { SnapshotSerializer } from '../SnapshotSerializer'
import { SnapshotValidator } from '../SnapshotValidator'
import type { EventEnvelope } from '../EventEnvelope'

/* ─── Mock Journal ─── */

function createMockJournal(): IEventJournal {
  const snapshots = new Map<string, SnapshotRecord[]>()
  const events: Record<string, any>[] = []

  return {
    append: vi.fn().mockResolvedValue({} as EventEnvelope),
    flush: vi.fn().mockResolvedValue(undefined),
    rotate: vi.fn().mockResolvedValue(undefined),
    recover: vi.fn().mockResolvedValue({ ok: true, lastSequence: 0, eventCount: 0, errors: [] }),
    read: vi.fn().mockReturnValue((async function* () {})()),
    getCurrentSequence: vi.fn().mockReturnValue(0),
    close: vi.fn().mockResolvedValue(undefined),

    checkpoint: vi.fn().mockImplementation((evts: any[], snap: any) => {
      // Simulate atomic write
      snapshots.set(snap.aggregate_id, [snap as SnapshotRecord])
      return { events: evts, snapshotSequence: snap.sequence }
    }),

    saveSnapshot: vi.fn().mockImplementation((snap: SnapshotRecord) => {
      const existing = snapshots.get(snap.aggregate_id) ?? []
      snapshots.set(snap.aggregate_id, [...existing, snap])
    }),

    loadSnapshot: vi.fn().mockImplementation((id: string) => {
      const list = snapshots.get(id)
      if (!list || list.length === 0) return null
      // Return the one with the highest sequence
      return list.reduce((a, b) => (a.sequence > b.sequence ? a : b))
    }),

    listAggregateIds: vi.fn().mockImplementation(() => Array.from(snapshots.keys())),

    pruneSnapshots: vi.fn().mockImplementation((keepLast: number) => {
      let totalRemoved = 0
      for (const [id, list] of snapshots) {
        if (list.length > keepLast) {
          const sorted = [...list].sort((a, b) => b.sequence - a.sequence)
          const kept = sorted.slice(0, keepLast)
          snapshots.set(id, kept)
          totalRemoved += sorted.length - kept.length
        }
      }
      return totalRemoved
    }),

    getLastAppliedSequence: vi.fn().mockImplementation(() => {
      let max = 0
      for (const list of snapshots.values()) {
        for (const snap of list) {
          if (snap.last_applied_sequence && snap.last_applied_sequence > max) {
            max = snap.last_applied_sequence
          }
        }
      }
      return max
    }),
  }
}

/* ─── Factory ─── */

function createManager(journal?: IEventJournal) {
  const j = journal ?? createMockJournal()
  return {
    journal: j,
    policy: new SnapshotPolicy(),
    serializer: new SnapshotSerializer(),
    validator: new SnapshotValidator(new SnapshotSerializer()),
    manager: new SnapshotManager(
      j,
      new SnapshotPolicy(),
      new SnapshotSerializer(),
      new SnapshotValidator(new SnapshotSerializer()),
    ),
  }
}

function makeAggregate(overrides: Partial<AggregateSnapshotInput> = {}): AggregateSnapshotInput {
  return {
    aggregateId: 'trade',
    state: { balance: 1000, symbol: 'XRPUSDT' },
    sequence: 100,
    ...overrides,
  }
}

/* ─═══ Tests ═══─ */

describe('SnapshotManager', () => {
  describe('evaluate', () => {
    it('delegates to policy and returns decision', () => {
      const { manager } = createManager()
      const decision = manager.evaluate({
        currentSequence: 500,
        lastSnapshotSequence: 400,
        lastSnapshotTimestamp: Date.now(),
        eventsSinceSnapshot: 5,
        activeTradeIds: [],
        activePositionIds: [],
        dirtyRuntimes: [],
        isShuttingDown: false,
        isEmergencyStop: false,
        isTradeClosed: false,
        isPositionChanged: false,
      })
      expect(decision.shouldSnapshot).toBe(false)
    })

    it('returns shouldSnapshot=true when emergency stop is on', () => {
      const { manager } = createManager()
      const decision = manager.evaluate({
        currentSequence: 500,
        lastSnapshotSequence: 400,
        lastSnapshotTimestamp: Date.now(),
        eventsSinceSnapshot: 5,
        activeTradeIds: [],
        activePositionIds: [],
        dirtyRuntimes: [],
        isShuttingDown: false,
        isEmergencyStop: true,
        isTradeClosed: false,
        isPositionChanged: false,
      })
      expect(decision.shouldSnapshot).toBe(true)
      expect(decision.priority).toBe('critical')
    })
  })

  describe('createSnapshot', () => {
    it('saves snapshot for single aggregate', () => {
      const { manager, journal } = createManager()
      const agg = makeAggregate()
      const records = manager.createSnapshot([agg], 'Manual save')

      expect(records).toHaveLength(1)
      expect(records[0].aggregate_id).toBe('trade')
      expect(records[0].sequence).toBe(100)
      expect(records[0].checksum).toBeTruthy()
      expect(records[0].snapshot_version).toBe(1)
      expect(journal.saveSnapshot).toHaveBeenCalledOnce()
    })

    it('saves multiple aggregates', () => {
      const { manager, journal } = createManager()
      const records = manager.createSnapshot([
        makeAggregate({ aggregateId: 'trade', state: { balance: 500 } }),
        makeAggregate({ aggregateId: 'wallet', state: { balance: 10000 } }),
      ], 'Periodic')

      expect(records).toHaveLength(2)
      expect(journal.saveSnapshot).toHaveBeenCalledTimes(2)
    })

    it('assigns correct snapshot_version', () => {
      const { manager, journal } = createManager()
      const records = manager.createSnapshot([
        makeAggregate({ snapshotVersion: 2 }),
      ], 'v2 test')
      expect(records[0].snapshot_version).toBe(2)
    })

    it('checksum is SHA-256 hex string', () => {
      const { manager } = createManager()
      const agg = makeAggregate({ state: { secret: 'data' } })
      const [record] = manager.createSnapshot([agg], 'checksum test')
      expect(record.checksum).toMatch(/^[a-f0-9]{64}$/)
    })

    it('returns empty array for empty aggregates', () => {
      const { manager } = createManager()
      const records = manager.createSnapshot([], 'Empty')
      expect(records).toHaveLength(0)
    })
  })

  describe('restoreLatest', () => {
    it('returns ok=true with no snapshots', () => {
      const { manager } = createManager()
      const report = manager.restoreLatest()
      expect(report.ok).toBe(true)
      expect(report.totalAggregates).toBe(0)
      expect(report.recoveredAggregates).toBe(0)
    })

    it('recovers all saved aggregates', () => {
      const { manager } = createManager()
      manager.createSnapshot([
        makeAggregate({ aggregateId: 'trade', state: { balance: 500 }, sequence: 100 }),
        makeAggregate({ aggregateId: 'wallet', state: { balance: 10000 }, sequence: 50 }),
      ], 'test')

      const report = manager.restoreLatest()
      expect(report.ok).toBe(true)
      expect(report.totalAggregates).toBe(2)
      expect(report.recoveredAggregates).toBe(2)
    })

    it('deserializes state correctly', () => {
      const { manager } = createManager()
      const state = { balance: 500, symbol: 'XRPUSDT', trades: ['t1', 't2'] }
      manager.createSnapshot([makeAggregate({ state })], 'test')

      const report = manager.restoreLatest()
      const trade = report.aggregates.find(a => a.aggregateId === 'trade')
      expect(trade).toBeDefined()
      expect(trade!.state).toEqual(state)
      expect(trade!.valid).toBe(true)
    })

    it('sets lastAppliedSequence to min across aggregates', () => {
      const { manager } = createManager()
      manager.createSnapshot([
        makeAggregate({ aggregateId: 'trade', state: {}, sequence: 200 }),
        makeAggregate({ aggregateId: 'wallet', state: {}, sequence: 100 }),
      ], 'test')

      const report = manager.restoreLatest()
      expect(report.lastAppliedSequence).toBe(100)
    })

    it('sets snapshotSequence to max across aggregates', () => {
      const { manager } = createManager()
      manager.createSnapshot([
        makeAggregate({ aggregateId: 'trade', state: {}, sequence: 200 }),
        makeAggregate({ aggregateId: 'wallet', state: {}, sequence: 100 }),
      ], 'test')

      const report = manager.restoreLatest()
      expect(report.snapshotSequence).toBe(200)
    })
  })

  describe('restoreAggregate', () => {
    it('returns null for missing aggregate', () => {
      const { manager } = createManager()
      const result = manager.restoreAggregate('nonexistent')
      expect(result).toBeNull()
    })

    it('returns valid snapshot for existing aggregate', () => {
      const { manager } = createManager()
      const state = { balance: 500 }
      manager.createSnapshot([makeAggregate({ aggregateId: 'trade', state, sequence: 50 })], 'test')

      const result = manager.restoreAggregate('trade')
      expect(result).not.toBeNull()
      expect(result!.aggregateId).toBe('trade')
      expect(result!.state).toEqual(state)
      expect(result!.valid).toBe(true)
    })
  })

  describe('validate', () => {
    it('returns empty map when no snapshots exist', () => {
      const { manager } = createManager()
      const results = manager.validate()
      expect(Object.keys(results)).toHaveLength(0)
    })

    it('validates all saved snapshots', () => {
      const { manager } = createManager()
      manager.createSnapshot([
        makeAggregate({ aggregateId: 'trade', state: { x: 1 }, sequence: 10 }),
        makeAggregate({ aggregateId: 'wallet', state: { y: 2 }, sequence: 20 }),
      ], 'test')

      const results = manager.validate()
      expect(Object.keys(results)).toHaveLength(2)
      expect(results['trade'].valid).toBe(true)
      expect(results['wallet'].valid).toBe(true)
    })
  })

  describe('prune', () => {
    it('prunes old snapshots keeping only latest per aggregate', () => {
      const { manager, journal } = createManager()

      // Save multiple snapshots for same aggregate
      for (let i = 0; i < 5; i++) {
        journal.saveSnapshot({
          snapshot_id: `s-${i}`,
          aggregate_id: 'trade',
          sequence: (i + 1) * 100,
          snapshot_version: 1,
          checksum: null,
          last_applied_sequence: (i + 1) * 100,
          created_at: Date.now(),
          payload: JSON.stringify({ i }),
        })
      }

      const removed = manager.prune(2)
      expect(removed).toBeGreaterThanOrEqual(3)

      const loaded = journal.loadSnapshot('trade')
      expect(loaded).not.toBeNull()
      expect(loaded!.sequence).toBe(500)
    })
  })

  describe('shutdown', () => {
    it('creates final snapshots for active aggregates', () => {
      const { manager, journal } = createManager()
      const records = manager.shutdown([
        makeAggregate({ aggregateId: 'trade', state: { final: true }, sequence: 500 }),
      ])

      expect(records).toHaveLength(1)
      expect(records[0].aggregate_id).toBe('trade')
      expect(journal.saveSnapshot).toHaveBeenCalled()
    })

    it('returns empty array when no active aggregates', () => {
      const { manager } = createManager()
      const records = manager.shutdown([])
      expect(records).toHaveLength(0)
    })
  })

  describe('checkpoint', () => {
    it('checkpoint delegates to journal.checkpoint with serialized snapshot', () => {
      const { manager, journal } = createManager()
      const events = [{ id: 'e1', type: 'TradeOpened' }] as unknown as Omit<EventEnvelope, 'sequence'>[]

      const result = manager.checkpoint(events, [
        makeAggregate({ aggregateId: 'trade', state: { balance: 100 }, sequence: 42 }),
      ])

      expect(result).toBeDefined()
      expect(journal.checkpoint).toHaveBeenCalledOnce()
      // Ensure the snapshot was serialized with checksum
      const callArgs = (journal.checkpoint as any).mock.calls[0]
      const snapshotArg = callArgs[1]
      expect(snapshotArg.checksum).toMatch(/^[a-f0-9]{64}$/)
      expect(snapshotArg.aggregate_id).toBe('trade')
    })
  })

  describe('metrics integration', () => {
    it('calls incCreateTotal on createSnapshot', () => {
      const metrics: SnapshotMetricsCollector = {
        incCreateTotal: vi.fn(),
        incRestoreTotal: vi.fn(),
        incValidationFailed: vi.fn(),
        observeDuration: vi.fn(),
        observeRestoreDuration: vi.fn(),
        observeSizeBytes: vi.fn(),
        incPrunedTotal: vi.fn(),
      }
      const manager = new SnapshotManager(
        createMockJournal(),
        new SnapshotPolicy(),
        new SnapshotSerializer(),
        new SnapshotValidator(new SnapshotSerializer()),
        metrics,
      )

      manager.createSnapshot([makeAggregate()], 'metric test')

      expect(metrics.incCreateTotal).toHaveBeenCalled()
      expect(metrics.observeDuration).toHaveBeenCalled()
      expect(metrics.observeSizeBytes).toHaveBeenCalled()
    })

    it('calls incRestoreTotal on restoreLatest', () => {
      const metrics: SnapshotMetricsCollector = {
        incCreateTotal: vi.fn(),
        incRestoreTotal: vi.fn(),
        incValidationFailed: vi.fn(),
        observeDuration: vi.fn(),
        observeRestoreDuration: vi.fn(),
        observeSizeBytes: vi.fn(),
        incPrunedTotal: vi.fn(),
      }
      const journal = createMockJournal()
      const manager = new SnapshotManager(
        journal,
        new SnapshotPolicy(),
        new SnapshotSerializer(),
        new SnapshotValidator(new SnapshotSerializer()),
        metrics,
      )

      journal.saveSnapshot({
        snapshot_id: 'ss-1',
        aggregate_id: 'trade',
        sequence: 100,
        snapshot_version: 1,
        checksum: null,
        last_applied_sequence: 100,
        created_at: Date.now(),
        payload: JSON.stringify({ balance: 1000 }),
      })

      manager.restoreLatest()
      expect(metrics.incRestoreTotal).toHaveBeenCalledWith('latest')
      expect(metrics.observeRestoreDuration).toHaveBeenCalled()
    })
  })
})
