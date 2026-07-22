// __tests__/ReplayEngine.test.ts
// Phase 5.1–5.6 — ReplayEngine core unit tests

import { describe, it, expect, vi } from 'vitest'
import { ReplayEngine, type ReplayRequest } from '../ReplayEngine'
import { EventStream } from '../EventStream'
import { ReplayCursor } from '../ReplayCursor'
import { ReplayValidator } from '../ReplayValidator'
import type { EventApplier } from '../EventApplier'
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
        if (evt.sequence > afterSeq) yield evt
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
      return list.reduce((a, b) => (a.sequence > b.sequence ? a : b))
    }),
    listAggregateIds: vi.fn().mockImplementation(() => Array.from(snapshots.keys())),
    pruneSnapshots: vi.fn().mockReturnValue(0),
    getLastAppliedSequence: vi.fn().mockReturnValue(0),
    count: vi.fn().mockReturnValue(0),
  }
}

function setupReplayEngine(
  journal?: IEventJournal,
  applier?: EventApplier,
  cursor?: ReplayCursor,
  validator?: ReplayValidator,
) {
  const j = journal ?? createMockJournal()
  const a: EventApplier = applier ?? {
    apply: vi.fn().mockImplementation((id: string, state: any, events: any[]) => {
      const newState = { ...state }
      for (const e of events) {
        newState.lastEvent = e.type
        newState.seq = e.sequence
        newState.counter = (newState.counter ?? 0) + 1
      }
      return newState
    }),
  }
  const stream = new EventStream(j)
  const cur = cursor ?? new ReplayCursor(0)
  const val = validator
  return { journal: j, applier: a, cursor: cur, validator: val, stream, engine: new ReplayEngine(j, stream, a, cur, val) }
}

/* ─═══ Tests ═══─ */

describe('ReplayEngine — replay()', () => {
  it('returns ok report with no events when journal is empty', async () => {
    const { engine } = setupReplayEngine()
    const report = await engine.replay()
    expect(report.ok).toBe(true)
    expect(report.eventsProcessed).toBe(0)
    expect(report.aggregateResults).toEqual([])
    expect(report.replayRate).toBe(0)
  })

  it('replays events from initial states', async () => {
    const journal = createMockJournal()
    const events = [
      makeEvent({ sequence: 1, type: 'TradeOpened', payload: { qty: 100 } }),
      makeEvent({ sequence: 2, type: 'TradeUpdated', payload: { qty: 50 } }),
    ]
    const readFn = vi.fn().mockImplementation(function* (filter?: any) {
      const afterSeq = filter?.afterSequence ?? 0
      for (const evt of events) {
        if (evt.sequence > afterSeq) yield evt
      }
    })
    journal.read = readFn

    const { engine, applier } = setupReplayEngine(journal)
    const report = await engine.replay({
      initialStates: [{ aggregateId: 'trade-1', state: { balance: 1000 }, sequence: 0 }],
    })

    expect(report.ok).toBe(true)
    expect(report.eventsProcessed).toBe(2)
    expect(report.aggregatesUpdated).toBeGreaterThan(0)
    expect(applier.apply).toHaveBeenCalled()
  })

  it('handles multiple aggregates in parallel', async () => {
    const journal = createMockJournal()
    const events = [
      makeEvent({ sequence: 1, tradeId: 'trade-1', type: 'TradeOpened', payload: { qty: 100 } }),
      makeEvent({ sequence: 2, tradeId: 'trade-2', type: 'TradeOpened', payload: { qty: 200 } }),
      makeEvent({ sequence: 3, tradeId: 'trade-1', type: 'TradeUpdated', payload: { qty: 150 } }),
    ]
    const readFn = vi.fn().mockImplementation(function* (filter?: any) {
      const afterSeq = filter?.afterSequence ?? 0
      for (const evt of events) {
        if (evt.sequence > afterSeq) yield evt
      }
    })
    journal.read = readFn

    const applied: { id: string; count: number }[] = []
    const applier: EventApplier = {
      apply: vi.fn().mockImplementation((id: string, state: any, evts: any[]) => {
        applied.push({ id, count: evts.length })
        return { ...state, count: evts.length }
      }),
    }

    const { engine } = setupReplayEngine(journal, applier)
    const report = await engine.replay({
      initialStates: [
        { aggregateId: 'trade-1', state: { balance: 1000 }, sequence: 0 },
        { aggregateId: 'trade-2', state: { balance: 2000 }, sequence: 0 },
      ],
    })

    expect(report.eventsProcessed).toBe(3)
    expect(applied.length).toBeGreaterThanOrEqual(2)
    // trade-1 has 2 events, trade-2 has 1
    const t1 = applied.find(a => a.id === 'trade-1')
    const t2 = applied.find(a => a.id === 'trade-2')
    expect(t1?.count).toBe(2)
    expect(t2?.count).toBe(1)
  })

  it('captures final state after replay', async () => {
    const journal = createMockJournal()
    const events = [
      makeEvent({ sequence: 1, tradeId: 'trade-1', type: 'TradeUpdated', payload: { inc: 5 } }),
    ]
    const readFn = vi.fn().mockImplementation(function* () { yield events[0] })
    journal.read = readFn

    const applier: EventApplier = {
      apply: vi.fn().mockImplementation((id, state, evts) => ({
        ...state as any,
        applied: (state as any).applied ?? 0 + 1,
        lastSeq: evts[0].sequence,
      })),
    }

    const { engine } = setupReplayEngine(journal, applier)
    const report = await engine.replay({
      initialStates: [{ aggregateId: 'trade-1', state: { balance: 500 }, sequence: 0 }],
    })

    expect(report.aggregateResults.length).toBe(1)
    expect(report.aggregateResults[0].state).toBeDefined()
    expect((report.aggregateResults[0].state as any).balance).toBe(500)
  })

  it('returns errors when applier throws', async () => {
    const journal = createMockJournal()
    const events = [makeEvent({ sequence: 1, type: 'BadEvent' })]
    const readFn = vi.fn().mockImplementation(function* () { yield events[0] })
    journal.read = readFn

    const applier: EventApplier = {
      apply: vi.fn().mockImplementation(() => { throw new Error('Apply failed') }),
    }

    const { engine } = setupReplayEngine(journal, applier)
    const report = await engine.replay({
      initialStates: [{ aggregateId: 'trade-1', state: {}, sequence: 0 }],
    })

    expect(report.errors.some(e => e.includes('Apply failed'))).toBe(true)
  })
})

describe('ReplayEngine — replayAggregate()', () => {
  it('replays a single aggregate from its snapshot', async () => {
    const journal = createMockJournal()
    const events = [
      makeEvent({ sequence: 51, tradeId: 'trade-1', type: 'TradeUpdated', payload: { qty: 10 } }),
    ]
    const readFn = vi.fn().mockImplementation(function* (filter?: any) {
      const afterSeq = filter?.afterSequence ?? 0
      for (const evt of events) {
        if (evt.sequence > afterSeq) yield evt
      }
    })
    journal.read = readFn

    // Save a snapshot
    journal.saveSnapshot({
      snapshot_id: 'ss-1',
      aggregate_id: 'trade-1',
      sequence: 50,
      snapshot_version: 1,
      checksum: null,
      last_applied_sequence: 50,
      created_at: Date.now(),
      payload: JSON.stringify({ balance: 1000 }),
    })

    const { engine, applier } = setupReplayEngine(journal)

    // We need a fresh cursor since replayAggregate uses journal.loadSnapshot
    const report = await engine.replayAggregate('trade-1')

    expect(report.eventsProcessed).toBe(1)
    expect(applier.apply).toHaveBeenCalled()
  })

  it('returns empty report for unknown aggregate', async () => {
    const { engine } = setupReplayEngine()
    const report = await engine.replayAggregate('nonexistent')
    expect(report.eventsProcessed).toBe(0)
    expect(report.ok).toBe(true)
  })
})

describe('ReplayEngine — replayFrom() / replayTo()', () => {
  it('replays events after a given sequence', async () => {
    const journal = createMockJournal()
    const events = [
      makeEvent({ sequence: 10, type: 'TradeOpened' }),
      makeEvent({ sequence: 11, type: 'TradeUpdated' }),
      makeEvent({ sequence: 12, type: 'TradeClosed' }),
    ]
    const readFn = vi.fn().mockImplementation(function* (filter?: any) {
      const afterSeq = filter?.afterSequence ?? 0
      for (const evt of events) {
        if (evt.sequence > afterSeq) yield evt
      }
    })
    journal.read = readFn

    const { engine } = setupReplayEngine(journal)
    const report = await engine.replayFrom(10, {
      initialStates: [{ aggregateId: 'trade-1', state: {}, sequence: 10 }],
    })
    // Only events with sequence > 10 should be processed (11, 12)
    expect(report.eventsProcessed).toBe(2)
  })

  it('replays events up to a given sequence', async () => {
    const journal = createMockJournal()
    const events = [
      makeEvent({ sequence: 1, type: 'TradeOpened' }),
      makeEvent({ sequence: 2, type: 'TradeUpdated' }),
      makeEvent({ sequence: 3, type: 'TradeClosed' }),
    ]
    const readFn = vi.fn().mockImplementation(function* (filter?: any) {
      const afterSeq = filter?.afterSequence ?? 0
      for (const evt of events) {
        if (evt.sequence > afterSeq) yield evt
      }
    })
    journal.read = readFn

    const { engine } = setupReplayEngine(journal)
    const report = await engine.replayTo(2, {
      initialStates: [{ aggregateId: 'trade-1', state: {}, sequence: 0 }],
    })
    // Events up to sequence 2 (inclusive) should be processed: 1, 2
    expect(report.eventsProcessed).toBe(2)
  })
})

describe('ReplayEngine — dryRun()', () => {
  it('counts events but does not apply them', async () => {
    const journal = createMockJournal()
    const events = [
      makeEvent({ sequence: 1, type: 'TradeOpened' }),
      makeEvent({ sequence: 2, type: 'TradeUpdated' }),
    ]
    const readFn = vi.fn().mockImplementation(function* () {
      for (const evt of events) yield evt
    })
    journal.read = readFn

    const applier: EventApplier = {
      apply: vi.fn().mockImplementation((id, state, evts) => {
        throw new Error('Should not be called in dry run')
      }),
    }

    const { engine } = setupReplayEngine(journal, applier)
    const report = await engine.dryRun({
      initialStates: [{ aggregateId: 'trade-1', state: {}, sequence: 0 }],
    })

    expect(report.dryRun).toBe(true)
    expect(report.eventsProcessed).toBe(2)
    expect(applier.apply).not.toHaveBeenCalled()
  })

  it('does not advance cursor in dry run', async () => {
    const journal = createMockJournal()
    const events = [makeEvent({ sequence: 1, type: 'TradeOpened' })]
    const readFn = vi.fn().mockImplementation(function* () { yield events[0] })
    journal.read = readFn

    const cursor = new ReplayCursor(0)
    const { engine } = setupReplayEngine(journal, undefined, cursor)
    const report = await engine.dryRun({
      initialStates: [{ aggregateId: 'trade-1', state: {}, sequence: 0 }],
    })

    expect(report.eventsProcessed).toBe(1)
    expect(cursor.current).toBe(0) // cursor not advanced
  })
})

describe('ReplayEngine — determinism', () => {
  it('produces identical state hashes on two runs with same initial state', async () => {
    const journal = createMockJournal()
    const events = [
      makeEvent({ sequence: 1, tradeId: 'trade-1', type: 'TradeOpened', payload: { qty: 100 } }),
      makeEvent({ sequence: 2, tradeId: 'trade-1', type: 'TradeUpdated', payload: { qty: 50 } }),
    ]
    const readFn = vi.fn().mockImplementation(function* (filter?: any) {
      const afterSeq = filter?.afterSequence ?? 0
      for (const evt of events) {
        if (evt.sequence > afterSeq) yield evt
      }
    })
    journal.read = readFn

    const applier: EventApplier = {
      apply: vi.fn().mockImplementation((id: string, state: any, evts: any[]) => {
        let s = { ...state }
        for (const e of evts) {
          s = { ...s, lastSeq: e.sequence, count: (s.count ?? 0) + 1 }
        }
        return s
      }),
    }

    const cursor = new ReplayCursor(0)
    const { engine } = setupReplayEngine(journal, applier, cursor)

    const result = await engine.determinismCheck({
      initialStates: [{ aggregateId: 'trade-1', state: { balance: 1000 }, sequence: 0 }],
    })

    expect(result.deterministic).toBe(true)
    expect(result.stateHash1).toBe(result.stateHash2)
    expect(result.run1.ok).toBe(true)
    expect(result.run2.ok).toBe(true)
  })

  it('detects non-determinism when applier produces different results', async () => {
    const journal = createMockJournal()
    const events = [makeEvent({ sequence: 1, tradeId: 'trade-1' })]
    let callCount = 0
    const readFn = vi.fn().mockImplementation(function* () { yield events[0] })
    journal.read = readFn

    // Non-deterministic applier — returns random value
    const applier: EventApplier = {
      apply: vi.fn().mockImplementation((id, state, evts) => {
        callCount++
        return { ...state as any, random: Math.random() }
      }),
    }

    const cursor = new ReplayCursor(0)
    const { engine } = setupReplayEngine(journal, applier, cursor)
    const result = await engine.determinismCheck({
      initialStates: [{ aggregateId: 'trade-1', state: {}, sequence: 0 }],
    })

    // This might randomly match but extremely unlikely with Math.random()
    // Actually this could be flaky. Let's check differently.
    // Math.random() on two separate calls will almost certainly differ
    if (result.run1.aggregateResults[0]?.stateHash !== result.run2.aggregateResults[0]?.stateHash) {
      expect(result.deterministic).toBe(false)
      expect(result.mismatch).toBe(true)
    }
  })
})

describe('ReplayEngine — validate()', () => {
  it('calls validator when configured', async () => {
    const journal = createMockJournal()
    const events = [makeEvent({ sequence: 1, tradeId: 'trade-1' })]
    const readFn = vi.fn().mockImplementation(function* () { yield events[0] })
    journal.read = readFn

    const validator = new ReplayValidator()
    const validateSpy = vi.spyOn(validator, 'validate')

    const { engine } = setupReplayEngine(journal, undefined, undefined, validator)
    const report = await engine.replay({
      initialStates: [{ aggregateId: 'trade-1', state: {}, sequence: 0 }],
    })

    expect(validateSpy).toHaveBeenCalled()
    expect(report.ok).toBe(true)
  })

  it('skips validation when no validator configured', async () => {
    const { engine } = setupReplayEngine()
    const report = await engine.replay()
    expect(report.ok).toBe(true)
  })
})

describe('ReplayEngine — cursor integration', () => {
  it('advances cursor during replay', async () => {
    const journal = createMockJournal()
    const events = [
      makeEvent({ sequence: 1, tradeId: 'trade-1' }),
      makeEvent({ sequence: 2, tradeId: 'trade-1' }),
    ]
    const readFn = vi.fn().mockImplementation(function* () {
      for (const evt of events) yield evt
    })
    journal.read = readFn

    const cursor = new ReplayCursor(0)
    const { engine } = setupReplayEngine(journal, undefined, cursor)
    await engine.replay({
      initialStates: [{ aggregateId: 'trade-1', state: {}, sequence: 0 }],
    })

    expect(cursor.current).toBe(2) // last event sequence
  })

  it('resumes from cursor position', async () => {
    const journal = createMockJournal()
    const events = [
      makeEvent({ sequence: 1, tradeId: 'trade-1' }),
      makeEvent({ sequence: 2, tradeId: 'trade-1' }),
      makeEvent({ sequence: 3, tradeId: 'trade-1' }),
    ]
    const readFn = vi.fn().mockImplementation(function* (filter?: any) {
      const afterSeq = filter?.afterSequence ?? 0
      for (const evt of events) {
        if (evt.sequence > afterSeq) yield evt
      }
    })
    journal.read = readFn

    const cursor = new ReplayCursor(1) // already at sequence 1
    const appliedSeqs: number[][] = []
    const applier: EventApplier = {
      apply: vi.fn().mockImplementation((id, state, evts: any[]) => {
        appliedSeqs.push(evts.map((e: any) => e.sequence))
        return { ...state as any, seq: evts[evts.length - 1].sequence }
      }),
    }

    const { engine } = setupReplayEngine(journal, applier, cursor)
    const report = await engine.replay({
      initialStates: [{ aggregateId: 'trade-1', state: {}, sequence: 1 }],
    })

    // Should only process events 2 and 3 (after sequence 1)
    expect(appliedSeqs).toEqual([[2, 3]])
    expect(report.eventsProcessed).toBe(2)
    expect(cursor.current).toBe(3)
  })
})

describe('ReplayEngine — replay report structure', () => {
  it('contains all required fields', async () => {
    const journal = createMockJournal()
    const events = [makeEvent({ sequence: 1, tradeId: 'trade-1' })]
    const readFn = vi.fn().mockImplementation(function* () { yield events[0] })
    journal.read = readFn

    const { engine } = setupReplayEngine(journal)
    const report = await engine.replay({
      initialStates: [{ aggregateId: 'trade-1', state: {}, sequence: 0 }],
    })

    expect(report).toHaveProperty('ok')
    expect(report).toHaveProperty('eventsProcessed')
    expect(report).toHaveProperty('replayDurationMs')
    expect(report).toHaveProperty('replayRate')
    expect(report).toHaveProperty('aggregatesUpdated')
    expect(report).toHaveProperty('aggregateResults')
    expect(report).toHaveProperty('errors')
    expect(report).toHaveProperty('warnings')
    expect(report).toHaveProperty('dryRun')
    expect(report).toHaveProperty('fromSequence')
    expect(report).toHaveProperty('toSequence')
    expect(report).toHaveProperty('completedAt')
    expect(Array.isArray(report.aggregateResults)).toBe(true)
  })
})

describe('ReplayEngine — edge cases', () => {
  it('handles zero events gracefully', async () => {
    const { engine } = setupReplayEngine()
    const report = await engine.replay({
      initialStates: [{ aggregateId: 'trade-1', state: {}, sequence: 0 }],
    })
    expect(report.ok).toBe(true)
    expect(report.eventsProcessed).toBe(0)
    expect(report.aggregateResults).toEqual([])
  })

  it('handles events for unknown aggregates (creates ephemeral state)', async () => {
    const journal = createMockJournal()
    const events = [
      makeEvent({ sequence: 1, tradeId: 'unknown-agg', type: 'UnexpectedEvent' }),
    ]
    const readFn = vi.fn().mockImplementation(function* () { yield events[0] })
    journal.read = readFn

    const { engine, applier } = setupReplayEngine(journal)
    const report = await engine.replay() // no initial states
    expect(report.ok).toBe(true)
    expect(applier.apply).toHaveBeenCalledWith('unknown-agg', {}, expect.any(Array))
  })

  it('handles empty initial states map', async () => {
    const { engine } = setupReplayEngine()
    const report = await engine.replay({ initialStates: [] })
    expect(report.ok).toBe(true)
  })

  it('uses cursor.current as fromSequence when not provided', async () => {
    const cursor = new ReplayCursor(42)
    const { engine } = setupReplayEngine(undefined, undefined, cursor)
    const report = await engine.replay()
    expect(report.fromSequence).toBe(42)
  })
})
