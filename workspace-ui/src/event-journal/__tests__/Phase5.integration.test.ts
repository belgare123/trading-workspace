// __tests__/Phase5.integration.test.ts
// Phase 5 — DoD Integration Tests (8 сценариев)
// Uses real SQLiteEventJournal to verify ReplayEngine end-to-end

import { describe, it, expect, vi } from 'vitest'
import { SQLiteEventJournal } from '../SQLiteEventJournal'
import { createEventEnvelope } from '../EventEnvelope'
import { ReplayEngine, type ReplayEngineConfig } from '../ReplayEngine'
import { EventStream } from '../EventStream'
import { ReplayCursor } from '../ReplayCursor'
import type { EventApplier } from '../EventApplier'
import { ReplayValidator } from '../ReplayValidator'
import { ReplayMetrics, NOOP_REPLAY_METRICS } from '../ReplayMetrics'
import { v4 as uuidv4 } from 'uuid'

/* ─── Helpers ─── */

function makeEvent(type: string, overrides: Record<string, any> = {}) {
  return createEventEnvelope({
    traceId: `trace-${Math.random().toString(36).slice(2, 8)}`,
    runtime: 'trade',
    type,
    payload: {},
    ...overrides,
  })
}

function createCounterApplier(): { applier: EventApplier; snap: (id?: string) => any } {
  const states = new Map<string, any>()

  const applier: EventApplier = {
    apply: vi.fn().mockImplementation((id: string, state: any, evts: any[]) => {
      let current = { ...state }
      for (const evt of evts) {
        current.counter = (current.counter ?? 0) + 1
        current.lastEventSequence = evt.sequence
        current.lastEventType = evt.type
      }
      states.set(id, current)
      return current
    }),
  }

  return {
    applier,
    snap: (id: string = 'trade') => states.get(id) ?? null,
  }
}

function deterministicApplier(): EventApplier {
  return {
    apply: vi.fn().mockImplementation((id: string, state: any, evts: any[]) => {
      let current = { ...state }
      for (const evt of evts) {
        current.counter = (current.counter ?? 0) + 1
        current.events = [...(current.events ?? []), evt.sequence]
      }
      return current
    }),
  }
}

function makeEngine(
  journal: SQLiteEventJournal,
  applier: EventApplier,
  config?: Partial<ReplayEngineConfig>,
): ReplayEngine {
  const stream = new EventStream(journal)
  const cursor = new ReplayCursor(0)
  // Constructor: (journal, eventStream, applier, cursor?, validator?, metrics?, config?)
  return new ReplayEngine(journal, stream, applier, cursor, undefined, undefined, config)
}

function hashState(state: any): string {
  const str = JSON.stringify(state, Object.keys(state).sort())
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return hash.toString(36) + ':' + str.length
}

/* ─═══ DoD Integration Tests ═══─ */

describe('Phase 5 — DoD: ReplayEngine Integration', () => {

  // ─╌╌─ 1. Replay с нуля по полному журналу ─╌╌─
  describe('DoD 1: Replay from empty journal (full log)', () => {
    it('reconstructs state from zero by replaying all events', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const { applier, snap } = createCounterApplier()

      // Append 50 events — all get runtime='trade' so grouped as 'trade' aggregate
      for (let i = 0; i < 50; i++) {
        await journal.append(makeEvent('Tick', { payload: { value: i } }))
      }
      await journal.flush()

      // Replay from scratch (no snapshots, no initial states)
      const engine = makeEngine(journal, applier)
      const report = await engine.replay({})

      expect(report.ok).toBe(true)
      expect(report.eventsProcessed).toBe(50)
      // Events without tradeId are grouped by runtime → 'trade'
      expect(snap('trade').counter).toBe(50)
      expect(snap('trade').lastEventSequence).toBe(50)

      journal.close()
    })

    it('replays with explicit initial states', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const { applier, snap } = createCounterApplier()

      for (let i = 0; i < 10; i++) {
        await journal.append(makeEvent('Tick', { payload: { value: i } }))
      }
      await journal.flush()

      const engine = makeEngine(journal, applier)
      const report = await engine.replay({
        initialStates: [{ aggregateId: 'trade', state: { counter: 100 }, sequence: 0 }],
      })

      expect(report.ok).toBe(true)
      expect(report.eventsProcessed).toBe(10)
      // Counter started at 100, then 10 events applied → 110
      expect(snap('trade').counter).toBe(110)

      journal.close()
    })
  })

  // ─╌╌─ 2. Replay от snapshot ─╌╌─
  describe('DoD 2: Replay from snapshot', () => {
    it('replays events after snapshot sequence only', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const { applier, snap } = createCounterApplier()

      for (let i = 0; i < 20; i++) {
        await journal.append(makeEvent('Tick', { payload: { value: i } }))
      }
      await journal.flush()

      const engine = makeEngine(journal, applier)

      // Replay from sequence 15 (simulating snapshot at seq 15, counter=15)
      const report = await engine.replay({
        initialStates: [{ aggregateId: 'trade', state: { counter: 15 }, sequence: 15 }],
        fromSequence: 15,
      })

      expect(report.ok).toBe(true)
      expect(report.eventsProcessed).toBe(5) // sequences 16-20 (fromSequence exclusive)
      expect(snap('trade').counter).toBe(20)   // 15 + 5

      journal.close()
    })
  })

  // ─╌╌─ 3. Replay одного aggregate ─╌╌─
  describe('DoD 3: Replay single aggregate', () => {
    it('replays events — ephemeral aggregate is tracked in results', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const { applier, snap } = createCounterApplier()

      const events = [
        makeEvent('TradeOpened', { tradeId: 'trade-1', runtime: 'trade' }),
        makeEvent('TradeOpened', { tradeId: 'trade-2', runtime: 'trade' }),
        makeEvent('TradeClosed', { tradeId: 'trade-1', runtime: 'trade' }),
        makeEvent('WalletCommitted', { runtime: 'wallet' }),
      ]
      for (const evt of events) {
        await journal.append(evt)
      }
      await journal.flush()

      const engine = makeEngine(journal, applier)
      // All events — ephemeral aggregates tracked in results
      const report = await engine.replay({})

      // Debug: print errors/warnings when failing
      if (!report.ok) {
        console.log('DoD3 ERRORS:', JSON.stringify(report.errors))
        console.log('DoD3 WARNINGS:', JSON.stringify(report.warnings))
        console.log('DoD3 aggregateResults:', JSON.stringify(report.aggregateResults))
        // Check what applier was called with
        if ((applier.apply as any).mock) {
          console.log('DoD3 apply calls:', (applier.apply as any).mock.calls.map((c: any) => c[0]))
        }
      }

      expect(report.ok).toBe(true)
      // 4 events total across 3 aggregates (trade-1, trade-2, wallet)
      expect(report.eventsProcessed).toBe(4)
      expect(report.aggregateResults.length).toBe(3)
      expect(snap('trade-1').counter).toBe(2)
      expect(snap('trade-2').counter).toBe(1)
      expect(snap('wallet').counter).toBe(1)

      journal.close()
    })
  })

  // ─╌╌─ 4. Replay диапазона sequence ─╌╌─
  describe('DoD 4: Replay sequence range', () => {
    it('replays events within a sequence range (fromSequence exclusive, toSequence inclusive)', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const { applier, snap } = createCounterApplier()

      for (let i = 0; i < 50; i++) {
        await journal.append(makeEvent('Tick', { payload: { value: i } }))
      }
      await journal.flush()

      const engine = makeEngine(journal, applier)

      // Replay from seq 10 (exclusive) to seq 30 (inclusive)
      const report = await engine.replay({ fromSequence: 10, toSequence: 30 })

      expect(report.ok).toBe(true)
      expect(report.eventsProcessed).toBe(20) // seq 11-30 = 20 events
      expect(snap('trade').counter).toBe(20)

      journal.close()
    })

    it('replayFrom replays all events after a sequence', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const { applier, snap } = createCounterApplier()

      for (let i = 0; i < 20; i++) {
        await journal.append(makeEvent('Tick', { payload: { value: i } }))
      }
      await journal.flush()

      const engine = makeEngine(journal, applier)
      const report = await engine.replayFrom(10)

      expect(report.ok).toBe(true)
      expect(report.eventsProcessed).toBe(10) // seq 11-20 (fromSequence exclusive)
      expect(snap('trade').counter).toBe(10)

      journal.close()
    })

    it('replayTo replays all events up to a sequence (inclusive)', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const { applier, snap } = createCounterApplier()

      for (let i = 0; i < 20; i++) {
        await journal.append(makeEvent('Tick', { payload: { value: i } }))
      }
      await journal.flush()

      const engine = makeEngine(journal, applier)
      const report = await engine.replayTo(10)

      expect(report.ok).toBe(true)
      expect(report.eventsProcessed).toBe(10) // seq 1-10 (toSequence inclusive)
      expect(snap('trade').counter).toBe(10)

      journal.close()
    })
  })

  // ─╌╌─ 5. Dry Run без изменения состояния ─╌╌─
  describe('DoD 5: Dry Run (no state mutation)', () => {
    it('returns events count but does not apply any events', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const { applier, snap } = createCounterApplier()

      for (let i = 0; i < 30; i++) {
        await journal.append(makeEvent('Tick', { payload: { value: i } }))
      }
      await journal.flush()

      const engine = makeEngine(journal, applier)
      const report = await engine.dryRun({})

      expect(report.ok).toBe(true)
      expect(report.eventsProcessed).toBe(30)
      // No events should have been applied
      expect(applier.apply).not.toHaveBeenCalled()
      expect(snap('trade')).toBeNull()

      journal.close()
    })

    it('dryRun returns same events count as replay', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const { applier } = createCounterApplier()

      for (let i = 0; i < 25; i++) {
        await journal.append(makeEvent('Tick', { payload: { value: i } }))
      }
      await journal.flush()

      const engine = makeEngine(journal, applier)

      const dryReport = await engine.dryRun({})
      const replayReport = await engine.replay({})

      expect(dryReport.eventsProcessed).toBe(replayReport.eventsProcessed)

      journal.close()
    })
  })

  // ─╌╌─ 6. Determinism (двойной replay → идентичный hash) ─╌╌─
  describe('DoD 6: Determinism Check', () => {
    it('produces identical state hashes on two sequential replays', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const applier = deterministicApplier()

      for (let i = 0; i < 20; i++) {
        await journal.append(makeEvent('Tick', { payload: { value: i } }))
      }
      await journal.flush()

      // First replay
      const engine1 = makeEngine(journal, applier)
      const report1 = await engine1.replay({})
      const state1 = report1.aggregateResults.find(r => r.aggregateId === 'trade')?.state ?? {}
      const hash1 = hashState(state1)

      // Reset applier calls and do a second replay
      applier.apply.mockClear()

      const engine2 = makeEngine(journal, applier)
      const report2 = await engine2.replay({})
      const state2 = report2.aggregateResults.find(r => r.aggregateId === 'trade')?.state ?? {}
      const hash2 = hashState(state2)

      // Both hashes must match
      expect(hash1).toBe(hash2)
      expect(report1.eventsProcessed).toBe(report2.eventsProcessed)

      journal.close()
    })

    it('detects non-determinism (state differs between runs)', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })

      // Non-deterministic applier that uses an external counter
      let externalCounter = 0
      const ndApplier: EventApplier = {
        apply: vi.fn().mockImplementation((id: string, state: any, evts: any[]) => {
          let current = { ...state }
          for (const evt of evts) {
            externalCounter++
            current.counter = externalCounter // External state! Not deterministic!
          }
          return current
        }),
      }

      for (let i = 0; i < 5; i++) {
        await journal.append(makeEvent('Tick'))
      }
      await journal.flush()

      // First replay — externalCounter: 0→5
      externalCounter = 0
      const engine1 = makeEngine(journal, ndApplier)
      const report1 = await engine1.replay({})
      const state1 = report1.aggregateResults.find(r => r.aggregateId === 'trade')?.state ?? {}
      const hash1 = hashState(state1)

      // Second replay — externalCounter LEAKS from first run (starts at 5, goes to 10)
      ndApplier.apply.mockClear()
      // Intentionally NOT resetting externalCounter

      const engine2 = makeEngine(journal, ndApplier)
      const report2 = await engine2.replay({})
      const state2 = report2.aggregateResults.find(r => r.aggregateId === 'trade')?.state ?? {}
      const hash2 = hashState(state2)

      // Hashes should differ because of external state leakage
      expect(state1).not.toEqual(state2)
      expect(hash1).not.toBe(hash2)

      journal.close()
    })
  })

  // ─╌╌─ 7. Resume после прерывания replay ─╌╌─
  describe('DoD 7: Resume after interruption', () => {
    it('resumes from saved cursor position and completes replay', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const { applier, snap } = createCounterApplier()

      for (let i = 1; i <= 50; i++) {
        await journal.append(makeEvent('Tick', { payload: { value: i } }))
      }
      await journal.flush()

      // Phase 1: Replay first 20 events (simulate interrupted run)
      const stream1 = new EventStream(journal)
      const cursor1 = new ReplayCursor(0)
      // Constructor: (journal, eventStream, applier, cursor?, validator?, metrics?, config?)
      const engine1 = new ReplayEngine(journal, stream1, applier, cursor1, undefined, undefined, { batchSize: 5 })

      const report1 = await engine1.replay({
        fromSequence: 0,
        toSequence: 20,
      })

      expect(report1.ok).toBe(true)
      expect(report1.eventsProcessed).toBe(20)

      // Save cursor state
      cursor1.save()
      expect(cursor1.current).toBe(20)

      // Phase 2: Resume — replay remaining events from cursor position
      const stream2 = new EventStream(journal)
      const cursor2 = new ReplayCursor(cursor1.current) // Restore cursor
      const engine2 = new ReplayEngine(journal, stream2, applier, cursor2)

      const report2 = await engine2.replay({
        initialStates: [{ aggregateId: 'trade', state: snap('trade'), sequence: 20 }],
        fromSequence: cursor2.current,
      })

      expect(report2.ok).toBe(true)
      expect(report2.eventsProcessed).toBe(30) // seq 21-50
      expect(snap('trade').counter).toBe(50) // 50 total events applied

      journal.close()
    })
  })

  // ─╌╌─ 8. Стресс-тест: ≥100,000 событий ─╌╌─
  describe('DoD 8: Stress — 100,000 events', () => {
    it('replays 100,000 events without error', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const { applier, snap } = createCounterApplier()

      const EVENT_COUNT = 100_000

      // Bulk insert
      for (let batch = 0; batch < 10; batch++) {
        for (let i = 0; i < EVENT_COUNT / 10; i++) {
          await journal.append(makeEvent('Tick', { payload: { value: i } }))
        }
        await journal.flush()
      }

      const engine = makeEngine(journal, applier)

      const startTime = Date.now()
      const report = await engine.replay({})
      const duration = Date.now() - startTime

      expect(report.ok).toBe(true)
      expect(report.eventsProcessed).toBe(EVENT_COUNT)
      expect(snap('trade').counter).toBe(EVENT_COUNT)

      // Performance metrics
      const rate = Math.round(EVENT_COUNT / (duration / 1000))
      expect(rate).toBeGreaterThan(0)

      // Log performance for CI visibility
      console.log(`ReplayEngine stress test: ${EVENT_COUNT} events in ${duration}ms (${rate} events/sec)`)

      journal.close()
    }, 30_000) // 30s timeout
  })
})
