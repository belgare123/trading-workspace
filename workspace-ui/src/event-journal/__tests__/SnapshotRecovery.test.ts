// __tests__/SnapshotRecovery.test.ts
// Phase 4.3 → 5 — SnapshotRecovery pipeline tests (using ReplayEngine)

import { describe, it, expect, vi } from 'vitest'
import { SnapshotRecovery } from '../SnapshotRecovery'
import type { EventApplier } from '../EventApplier'
import { SnapshotManager } from '../SnapshotManager'
import { SnapshotPolicy } from '../SnapshotPolicy'
import { SnapshotSerializer } from '../SnapshotSerializer'
import { SnapshotValidator } from '../SnapshotValidator'
import { ReplayEngine } from '../ReplayEngine'
import { EventStream } from '../EventStream'
import { ReplayCursor } from '../ReplayCursor'
import type { IEventJournal } from '../IEventJournal'
import type { EventEnvelope } from '../EventEnvelope'

/* ─── Helpers ─── */

function makeEvent(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    traceId: 'trace-1',
    runtime: 'trade',
    type: 'TradeOpened',
    sequence: 1,
    timestamp: Date.now(),
    payload: {},
    metadata: { version: 1, schemaVersion: 1, source: 'test' },
    ...overrides,
  } as EventEnvelope
}

function createMockJournal(): IEventJournal {
  const snapshots = new Map<string, any[]>()
  const storedEvents: EventEnvelope[] = []

  return {
    append: vi.fn().mockResolvedValue({} as EventEnvelope),
    flush: vi.fn().mockResolvedValue(undefined),
    rotate: vi.fn().mockResolvedValue(undefined),
    recover: vi.fn().mockResolvedValue({ ok: true, lastSequence: 0, eventCount: 0, errors: [] }),
    read: vi.fn().mockImplementation(function* (filter?: any) {
      const afterSeq = filter?.afterSequence ?? 0
      for (const evt of storedEvents) {
        if (evt.sequence > afterSeq) {
          yield evt
        }
      }
    }),
    getCurrentSequence: vi.fn().mockReturnValue(storedEvents.length),
    close: vi.fn().mockResolvedValue(undefined),
    checkpoint: vi.fn(),
    saveSnapshot: vi.fn().mockImplementation((snap: any) => {
      const list = snapshots.get(snap.aggregate_id) ?? []
      list.push(snap)
      snapshots.set(snap.aggregate_id, list)
    }),
    loadSnapshot: vi.fn().mockImplementation((id: string) => {
      const list = snapshots.get(id)
      if (!list || list.length === 0) return null
      return list.reduce((a: any, b: any) => (a.sequence > b.sequence ? a : b))
    }),
    listAggregateIds: vi.fn().mockImplementation(() => Array.from(snapshots.keys())),
    pruneSnapshots: vi.fn().mockReturnValue(0),
    getLastAppliedSequence: vi.fn().mockReturnValue(0),
    count: vi.fn().mockReturnValue(0),
  }
}

function createSetup() {
  const journal = createMockJournal()

  const policy = new SnapshotPolicy()
  const serializer = new SnapshotSerializer()
  const validator = new SnapshotValidator(new SnapshotSerializer())
  const manager = new SnapshotManager(journal, policy, serializer, validator)

  // Event applier that simply accumulates events into the state
  const applier: EventApplier = {
    apply: vi.fn().mockImplementation((id: string, state: any, events: any[]) => {
      const newState = { ...state, replayedEvents: (state.replayedEvents ?? 0) + events.length }
      return newState
    }),
  }

  const eventStream = new EventStream(journal)
  const cursor = new ReplayCursor(0)
  const replayEngine = new ReplayEngine(journal, eventStream, applier, cursor)
  const recovery = new SnapshotRecovery(journal, manager, replayEngine)

  return { journal, manager, applier, recovery, cursor, replayEngine }
}

/* ─═══ Tests ═══─ */

describe('SnapshotRecovery', () => {
  it('returns ok report when no snapshots exist', async () => {
    const { recovery } = createSetup()
    const report = await recovery.recover()
    expect(report.ok).toBe(true)
    expect(report.replayedEvents).toBe(0)
    expect(report.totalAggregates).toBe(0)
  })

  it('recovers from a single snapshot with no replay needed', async () => {
    const { journal, manager, recovery } = createSetup()

    manager.createSnapshot([
      { aggregateId: 'trade', state: { balance: 1000 }, sequence: 50 },
    ], 'test')

    const report = await recovery.recover()
    expect(report.ok).toBe(true)
    expect(report.recoveredAggregates).toBe(1)
    expect(report.replayedEvents).toBe(0)
    expect(report.snapshotSequence).toBe(50)
  })

  it('replays events after snapshot sequence', async () => {
    const { journal, recovery, applier } = createSetup()

    const events = [
      makeEvent({ sequence: 101, type: 'TradeUpdated', payload: { qty: 50 } }),
      makeEvent({ sequence: 102, type: 'TradeUpdated', payload: { qty: 75 } }),
    ]

    const journalWithEvents = createMockJournal()
    const readFn = vi.fn().mockImplementation(function* (filter?: any) {
      const afterSeq = filter?.afterSequence ?? 0
      for (const evt of events) {
        if (evt.sequence > afterSeq) yield evt
      }
    })
    journalWithEvents.read = readFn

    const mgr = new SnapshotManager(
      journalWithEvents,
      new SnapshotPolicy(),
      new SnapshotSerializer(),
      new SnapshotValidator(new SnapshotSerializer()),
    )

    mgr.createSnapshot([
      { aggregateId: 'trade', state: { balance: 1000 }, sequence: 100 },
    ], 'test')

    const snap = journalWithEvents.loadSnapshot('trade')!
    snap.last_applied_sequence = 100

    const eventStream = new EventStream(journalWithEvents)
    const cursor = new ReplayCursor(0)
    const engine = new ReplayEngine(journalWithEvents, eventStream, applier, cursor)
    const rec = new SnapshotRecovery(journalWithEvents, mgr, engine)
    const report = await rec.recover()

    expect(report.ok).toBe(true)
    expect(report.replayedEvents).toBe(2)
    expect(report.lastAppliedSequence).toBe(100)
    expect(applier.apply).toHaveBeenCalled()
  })

  it('no replay when no events after snapshot', async () => {
    const { journal, manager, recovery } = createSetup()

    manager.createSnapshot([
      { aggregateId: 'trade', state: { balance: 1000 }, sequence: 100 },
    ], 'test')

    const report = await recovery.recover()
    expect(report.replayedEvents).toBe(0)
  })

  it('returns errors when snapshot validation fails', async () => {
    const { journal } = createSetup()

    // Directly save an invalid snapshot (missing aggregate_id)
    journal.saveSnapshot({
      snapshot_id: 'bad-ss',
      aggregate_id: '',
      sequence: 50,
      snapshot_version: 1,
      checksum: null,
      last_applied_sequence: 50,
      created_at: Date.now(),
      payload: '{}',
    })

    const mgr = new SnapshotManager(
      journal,
      new SnapshotPolicy(),
      new SnapshotSerializer(),
      new SnapshotValidator(new SnapshotSerializer()),
    )

    const applier: EventApplier = {
      apply: vi.fn().mockImplementation((id, state, events) => state),
    }
    const eventStream = new EventStream(journal)
    const cursor = new ReplayCursor(0)
    const engine = new ReplayEngine(journal, eventStream, applier, cursor)
    const rec = new SnapshotRecovery(journal, mgr, engine)
    const report = await rec.recover()

    // Missing aggregate_id -> validation error
    expect(report.ok).toBe(false)
    expect(report.errors.length).toBeGreaterThan(0)
  })

  it('calls applier for each aggregate during replay', async () => {
    const events = [
      makeEvent({ sequence: 51, tradeId: 'trade-1', type: 'TradeUpdated', payload: { qty: 10 } }),
      makeEvent({ sequence: 52, tradeId: 'trade-1', type: 'TradeUpdated', payload: { qty: 20 } }),
      makeEvent({ sequence: 53, tradeId: 'wallet-1', runtime: 'wallet', type: 'WalletCommitted', payload: { amount: 500 } }),
    ]

    const journal = createMockJournal()
    const readFn = vi.fn().mockImplementation(function* (filter?: any) {
      const afterSeq = filter?.afterSequence ?? 0
      for (const evt of events) {
        if (evt.sequence > afterSeq) yield evt
      }
    })
    journal.read = readFn

    const mgr = new SnapshotManager(
      journal,
      new SnapshotPolicy(),
      new SnapshotSerializer(),
      new SnapshotValidator(new SnapshotSerializer()),
    )

    mgr.createSnapshot([
      { aggregateId: 'trade-1', state: { balance: 500 }, sequence: 50 },
      { aggregateId: 'wallet-1', state: { balance: 10000 }, sequence: 50 },
    ], 'test')

    const applied: string[] = []
    const applier: EventApplier = {
      apply: vi.fn().mockImplementation((id: string, state: any, evts: any[]) => {
        applied.push(id)
        return { ...state, replayed: evts.length }
      }),
    }

    const eventStream = new EventStream(journal)
    const cursor = new ReplayCursor(0)
    const engine = new ReplayEngine(journal, eventStream, applier, cursor)
    const rec = new SnapshotRecovery(journal, mgr, engine)
    const report = await rec.recover()

    expect(report.replayedEvents).toBe(3)
    // Each aggregate that had events should be called
    expect(applied.length).toBeGreaterThan(0)
  })

  it('handles applier errors gracefully', async () => {
    const events = [
      makeEvent({ sequence: 51, type: 'TradeUpdated', payload: { bad: true } }),
    ]

    const journal = createMockJournal()
    const readFn = vi.fn().mockImplementation(function* () {
      yield events[0]
    })
    journal.read = readFn

    const mgr = new SnapshotManager(
      journal,
      new SnapshotPolicy(),
      new SnapshotSerializer(),
      new SnapshotValidator(new SnapshotSerializer()),
    )

    mgr.createSnapshot([
      { aggregateId: 'trade', state: { balance: 1000 }, sequence: 50 },
    ], 'test')

    const snap = journal.loadSnapshot('trade')!
    snap.last_applied_sequence = 50

    const applier: EventApplier = {
      apply: vi.fn().mockImplementation(() => {
        throw new Error('Corrupted state')
      }),
    }

    const eventStream = new EventStream(journal)
    const cursor = new ReplayCursor(0)
    const engine = new ReplayEngine(journal, eventStream, applier, cursor)
    const rec = new SnapshotRecovery(journal, mgr, engine)
    const report = await rec.recover()

    // Error should be caught and reported
    expect(report.errors.some(e => e.includes('Corrupted state'))).toBe(true)
  })
})
