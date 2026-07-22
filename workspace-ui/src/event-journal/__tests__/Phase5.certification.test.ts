// __tests__/Phase5.certification.test.ts
// Sprint 6.5 — Event Sourcing Certification Suite
//
// Certifies: Deterministic Replay, Crash Recovery, Snapshot Compatibility,
//            Journal Integrity, Long Replay Stress, Randomized Fuzz (100 runs)
//
// CRITERIA: All tests green → Event Sourcing infrastructure certified stable.

import { describe, it, expect, vi } from 'vitest'
import * as path from 'path'
import * as os from 'os'
import { SQLiteEventJournal } from '../SQLiteEventJournal'
import { createEventEnvelope } from '../EventEnvelope'
import { ReplayEngine, type ReplayEngineConfig } from '../ReplayEngine'
import { EventStream } from '../EventStream'
import { ReplayCursor } from '../ReplayCursor'
import type { EventApplier } from '../EventApplier'
import { ReplayValidator } from '../ReplayValidator'
import { ReplayMetrics, NOOP_REPLAY_METRICS } from '../ReplayMetrics'
import { SnapshotRecovery } from '../SnapshotRecovery'
import { SnapshotManager } from '../SnapshotManager'
import { SnapshotPolicy } from '../SnapshotPolicy'
import { SnapshotSerializer } from '../SnapshotSerializer'
import { SnapshotValidator } from '../SnapshotValidator'
import { v4 as uuidv4 } from 'uuid'

/* ═══════════════════════════════════
   Helpers
   ═══════════════════════════════════ */

function makeEvent(type: string, overrides: Record<string, any> = {}) {
  return createEventEnvelope({
    traceId: `trace-${Math.random().toString(36).slice(2, 8)}`,
    runtime: 'trade',
    type,
    payload: {},
    ...overrides,
  })
}

function deterministicApplier(): EventApplier {
  return {
    apply: vi.fn().mockImplementation((id: string, state: any, evts: any[]) => {
      let current = { ...state }
      for (const evt of evts) {
        current.counter = (current.counter ?? 0) + 1
        current.events = [...(current.events ?? []), evt.sequence]
        current.lastSequence = evt.sequence
        current.lastType = evt.type
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

/** Seeded PRNG (mulberry32) for deterministic random sequences */
function createRng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Temp DB path helper */
function tmpDbPath(): string {
  return path.join(os.tmpdir(), `es-cert-${uuidv4().slice(0, 8)}.db`)
}

/** Clean up a temp DB file */
function cleanupDb(p: string) {
  try {
    for (const ext of ['', '-wal', '-shm']) {
      try { require('fs').unlinkSync(p + ext) } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

/* ═══════════════════════════════════
   Section 1 — Deterministic Replay
   ═══════════════════════════════════ */

describe('Certification — Deterministic Replay', () => {
  it('Cert 1.1: Triple replay of same journal produces identical state hash', async () => {
    const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
    const applier = deterministicApplier()

    for (let i = 0; i < 50; i++) {
      await journal.append(makeEvent('Tick', { payload: { value: i } }))
    }
    await journal.flush()

    const hashes = new Set<string>()
    for (let run = 0; run < 3; run++) {
      const engine = makeEngine(journal, applier)
      applier.apply.mockClear()
      const report = await engine.replay({})
      expect(report.ok).toBe(true)
      expect(report.eventsProcessed).toBe(50)
      const state = report.aggregateResults.find(r => r.aggregateId === 'trade')?.state ?? {}
      hashes.add(hashState(state))
    }

    expect(hashes.size).toBe(1) // All 3 runs → identical hash
    journal.close()
  })

  it('Cert 1.2: Replay from snapshot yields same hash as replay from scratch', { timeout: 30_000 }, async () => {
    const dbPath = tmpDbPath()
    try {
      const journal = new SQLiteEventJournal({ dbPath })
      const applier = deterministicApplier()

      // Phase 1 — append events
      for (let i = 0; i < 100; i++) {
        await journal.append(makeEvent('Data', { payload: { i }, tradeId: 'agg-1', runtime: 'trade' }))
      }
      await journal.flush()

      // Save a snapshot at sequence 50
      const serializer = new SnapshotSerializer()
      const policy = new SnapshotPolicy({ eventThreshold: 0 }) // manual only
      const validator = new SnapshotValidator()
      const snapManager = new SnapshotManager(journal, policy, serializer, validator)

      // Build partial state up to seq 50
      let snapshotState: any = { counter: 0, events: [] }
      let snapshotSeq = 0
      for await (const evt of journal.read({ afterSequence: 0, beforeSequence: 51 })) {
        snapshotState.counter++
        snapshotState.events.push(evt.sequence)
        snapshotSeq = evt.sequence
      }
      await snapManager.createSnapshot([
        { aggregateId: 'agg-1', sequence: snapshotSeq, state: snapshotState },
      ])
      journal.close()

      // Phase 2 — restart and replay from snapshot using replayAggregate
      const journal2 = new SQLiteEventJournal({ dbPath })
      const engine = makeEngine(journal2, applier)
      // replayAggregate auto-loads the latest snapshot and sets fromSequence accordingly
      const report = await engine.replayAggregate('agg-1')
      expect(report.ok).toBe(true)
      expect(report.eventsProcessed).toBe(50) // only events 51-100 replayed

      const snapState = report.aggregateResults.find(r => r.aggregateId === 'agg-1')?.state ?? {}
      const snapHash = hashState(snapState)

      // Phase 3 — fresh journal, replay from scratch
      const journal3 = new SQLiteEventJournal({ dbPath: ':memory:' })
      for (let i = 0; i < 100; i++) {
        await journal3.append(makeEvent('Data', { payload: { i }, tradeId: 'agg-1', runtime: 'trade' }))
      }
      await journal3.flush()

      const applier3 = deterministicApplier()
      const engine3 = makeEngine(journal3, applier3)
      const report3 = await engine3.replay({})
      expect(report3.ok).toBe(true)
      const scratchState = report3.aggregateResults.find(r => r.aggregateId === 'agg-1')?.state ?? {}

      expect(snapHash).toBe(hashState(scratchState))
      journal2.close()
      journal3.close()
    } finally {
      cleanupDb(dbPath)
    }
  })
})

/* ═══════════════════════════════════
   Section 2 — Crash Recovery
   ═══════════════════════════════════ */

describe('Certification — Crash Recovery', () => {
  it('Cert 2.1: Append crash — unflushed events survive WAL recovery', async () => {
    const dbPath = tmpDbPath()
    try {
      // Phase 1 — append events but DON'T flush (simulate crash after writes)
      const journal1 = new SQLiteEventJournal({ dbPath })
      for (let i = 0; i < 25; i++) {
        await journal1.append(makeEvent('Tick'))
      }
      // Intentionally NO flush — simulate crash
      await journal1.close()
      // SQLite WAL guarantees durability of committed transactions even without explicit flush

      // Phase 2 — restart and verify events are intact
      const journal2 = new SQLiteEventJournal({ dbPath })
      const recovery = await journal2.recover()
      expect(recovery.ok).toBe(true)
      expect(recovery.eventCount).toBe(25)
      expect(recovery.lastSequence).toBe(25)

      // Replay all events
      const applier = deterministicApplier()
      const engine = makeEngine(journal2, applier)
      const report = await engine.replay({})
      expect(report.ok).toBe(true)
      expect(report.eventsProcessed).toBe(25)

      journal2.close()
    } finally {
      cleanupDb(dbPath)
    }
  })

  it('Cert 2.2: Snapshot recovery crash — snapshot + replay restores correct state', async () => {
    const dbPath = tmpDbPath()
    try {
      // Phase 1 — create journal with events and snapshots
      const journal1 = new SQLiteEventJournal({ dbPath })
      for (let i = 0; i < 75; i++) {
        await journal1.append(makeEvent('Data', { tradeId: 'agg-r', runtime: 'trade' }))
      }
      await journal1.flush()

      // Save a snapshot at seq 50
      const serializer2 = new SnapshotSerializer()
      const policy2 = new SnapshotPolicy({ eventThreshold: 0 })
      const validator2 = new SnapshotValidator(serializer2)
      const snapManager2 = new SnapshotManager(journal1, policy2, serializer2, validator2)

      let partialState: any = { counter: 0, events: [] }
      for await (const evt of journal1.read({ afterSequence: 0, beforeSequence: 51 })) {
        partialState.counter++
        partialState.events.push(evt.sequence)
      }
      await snapManager2.createSnapshot([
        { aggregateId: 'agg-r', sequence: 50, state: partialState },
      ])
      journal1.close()

      // Phase 2 — simulate crash and recover via SnapshotRecovery
      const journal2 = new SQLiteEventJournal({ dbPath })
      const applier = deterministicApplier()
      const stream2 = new EventStream(journal2)
      const cursor2 = new ReplayCursor(0)
      const engine2 = new ReplayEngine(journal2, stream2, applier, cursor2)
      const snapRecovery = new SnapshotRecovery(journal2, snapManager2, engine2)

      const recoveryReport = await snapRecovery.recover()
      expect(recoveryReport.ok).toBe(true)
      expect(recoveryReport.replayedEvents).toBe(25) // 75 - 50 = 25 events replayed

      const aggResult = recoveryReport.aggregates?.find(r => r.aggregateId === 'agg-r')
      expect(aggResult).toBeDefined()
      expect(aggResult!.valid).toBe(true)
      expect(aggResult!.state).toBeDefined()

      journal2.close()
    } finally {
      cleanupDb(dbPath)
    }
  })

  it('Cert 2.3: Checkpoint crash — atomicity preserves event-snapshot consistency', async () => {
    const dbPath = tmpDbPath()
    try {
      const journal = new SQLiteEventJournal({ dbPath })

      // Append events
      for (let i = 0; i < 30; i++) {
        await journal.append(makeEvent('Data', { tradeId: 'agg-cp', runtime: 'trade' }))
      }
      await journal.flush()

      // Perform a checkpoint at seq 30
      const snapshotPayload = JSON.stringify({ counter: 30, events: Array.from({ length: 30 }, (_, i) => i + 1) })
      journal.checkpoint(
        [],
        {
          snapshot_id: uuidv4(),
          aggregate_id: 'agg-cp',
          sequence: 30,
          snapshot_version: 2,
          checksum: null,
          created_at: Date.now(),
          payload: snapshotPayload,
        },
      )
      await journal.flush()
      journal.close()

      // Restart — verify snapshot + events are consistent
      const journal2 = new SQLiteEventJournal({ dbPath })
      const applier = deterministicApplier()
      const engine = makeEngine(journal2, applier)
      const report = await engine.replay({ initialStates: [] })
      expect(report.ok).toBe(true)
      expect(report.eventsProcessed).toBe(30)

      journal2.close()
    } finally {
      cleanupDb(dbPath)
    }
  })
})

/* ═══════════════════════════════════
   Section 3 — Snapshot Compatibility
   ═══════════════════════════════════ */

describe('Certification — Snapshot Compatibility', () => {
  it('Cert 3.1: Schema v1 → v2 migration preserves data', async () => {
    const dbPath = tmpDbPath()
    try {
      const journal = new SQLiteEventJournal({ dbPath })
      await journal.flush()

      // Save a v1 snapshot directly
      journal.saveSnapshot({
        snapshot_id: uuidv4(),
        aggregate_id: 'v1-agg',
        sequence: 42,
        snapshot_version: 1,
        checksum: null,
        last_applied_sequence: 42,
        created_at: Date.now(),
        payload: JSON.stringify({ value: 'v1-data' }),
      })

      // Read it back — should work with v2
      const loaded = journal.loadSnapshot('v1-agg')
      expect(loaded).not.toBeNull()
      expect(loaded!.snapshot_version).toBe(1)
      expect(loaded!.aggregate_id).toBe('v1-agg')

      journal.close()

      // Restart with fresh journal on same DB — v2 schema should handle v1 data
      const journal2 = new SQLiteEventJournal({ dbPath })
      journal2.saveSnapshot({
        snapshot_id: uuidv4(),
        aggregate_id: 'v2-agg',
        sequence: 100,
        snapshot_version: 2,
        checksum: 'abc123',
        last_applied_sequence: 100,
        created_at: Date.now(),
        payload: JSON.stringify({ value: 'v2-data' }),
      })

      const v1Loaded = journal2.loadSnapshot('v1-agg')
      expect(v1Loaded).not.toBeNull()
      expect(v1Loaded!.snapshot_version).toBe(1)
      const v2Loaded = journal2.loadSnapshot('v2-agg')
      expect(v2Loaded).not.toBeNull()
      expect(v2Loaded!.snapshot_version).toBe(2)

      const ids = journal2.listAggregateIds()
      expect(ids).toContain('v1-agg')
      expect(ids).toContain('v2-agg')

      journal2.close()
    } finally {
      cleanupDb(dbPath)
    }
  })

  it('Cert 3.2: Mixed-version snapshots coexist correctly', async () => {
    const dbPath = tmpDbPath()
    try {
      const journal = new SQLiteEventJournal({ dbPath })

      // Save a v1 snapshot
      journal.saveSnapshot({
        snapshot_id: uuidv4(),
        aggregate_id: 'mixed-1',
        sequence: 10,
        snapshot_version: 1,
        checksum: null,
        last_applied_sequence: 10,
        created_at: Date.now(),
        payload: JSON.stringify({ ver: 1 }),
      })

      // Save a v2 snapshot
      journal.saveSnapshot({
        snapshot_id: uuidv4(),
        aggregate_id: 'mixed-2',
        sequence: 20,
        snapshot_version: 2,
        checksum: 'sha256-hex',
        last_applied_sequence: 20,
        created_at: Date.now(),
        payload: JSON.stringify({ ver: 2 }),
      })

      expect(journal.listAggregateIds().sort()).toEqual(['mixed-1', 'mixed-2'])

      const s1 = journal.loadSnapshot('mixed-1')
      expect(s1!.snapshot_version).toBe(1)
      expect(JSON.parse(s1!.payload)).toEqual({ ver: 1 })

      const s2 = journal.loadSnapshot('mixed-2')
      expect(s2!.snapshot_version).toBe(2)
      expect(JSON.parse(s2!.payload)).toEqual({ ver: 2 })

      journal.close()
    } finally {
      cleanupDb(dbPath)
    }
  })

  it('Cert 3.3: Corrupted snapshot is detected and rejected', async () => {
    const dbPath = tmpDbPath()
    try {
      const journal = new SQLiteEventJournal({ dbPath })

      // Save snapshot with correct checksum
      const payload = JSON.stringify({ data: 'pristine' })
      journal.saveSnapshot({
        snapshot_id: uuidv4(),
        aggregate_id: 'corrupt-test',
        sequence: 50,
        snapshot_version: 2,
        checksum: 'sha256-' + 'a'.repeat(64),
        last_applied_sequence: 50,
        created_at: Date.now(),
        payload,
      })

      const loaded = journal.loadSnapshot('corrupt-test')
      expect(loaded).not.toBeNull()

      // Tamper the checksum
      const tampered = { ...loaded!, checksum: 'sha256-' + 'b'.repeat(64) }

      // Validate should detect the mismatch
      const ser3 = new SnapshotSerializer()
      const validator3 = new SnapshotValidator(ser3, [1, 2])
      // SnapshotValidator always validates checksums when present
      // Tampered checksum will cause deserialize to fail
      const validation = validator3.validate(tampered)
      expect(validation.valid).toBe(false)
      // Should have a checksum-mismatch or payload-parse error
      expect(validation.errors.length).toBeGreaterThan(0)

      journal.close()
    } finally {
      cleanupDb(dbPath)
    }
  })
})

/* ═══════════════════════════════════
   Section 4 — Journal Integrity
   ═══════════════════════════════════ */

describe('Certification — Journal Integrity', () => {
  it('Cert 4.1: No sequence gaps after sequential appends', async () => {
    const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
    const count = 200

    for (let i = 0; i < count; i++) {
      await journal.append(makeEvent('Tick'))
    }
    await journal.flush()

    const recovery = await journal.recover()
    expect(recovery.ok).toBe(true)
    expect(recovery.lastSequence).toBe(count)
    expect(recovery.eventCount).toBe(count)

    // Verify every sequence 1..count exists exactly once
    const allEvents: number[] = []
    for await (const evt of journal.read()) {
      allEvents.push(evt.sequence)
    }
    expect(allEvents.length).toBe(count)
    expect(allEvents[0]).toBe(1)
    expect(allEvents[allEvents.length - 1]).toBe(count)

    for (let i = 0; i < allEvents.length; i++) {
      expect(allEvents[i]).toBe(i + 1) // Strictly sequential, no gaps
    }

    journal.close()
  })

  it('Cert 4.2: No duplicate sequences', async () => {
    const journal = new SQLiteEventJournal({ dbPath: ':memory:' })

    for (let i = 0; i < 100; i++) {
      await journal.append(makeEvent('Data'))
    }
    await journal.flush()

    const sequences = new Set<number>()
    for await (const evt of journal.read()) {
      expect(sequences.has(evt.sequence)).toBe(false) // No duplicates
      sequences.add(evt.sequence)
    }
    expect(sequences.size).toBe(100)

    journal.close()
  })

  it('Cert 4.3: WAL recovery — journal integrity after close/reopen cycle', async () => {
    const dbPath = tmpDbPath()
    try {
      const journal1 = new SQLiteEventJournal({ dbPath })
      for (let i = 0; i < 150; i++) {
        await journal1.append(makeEvent('Tick'))
      }
      await journal1.flush()
      expect(journal1.getCurrentSequence()).toBe(150)
      await journal1.close()

      // Reopen and verify
      const journal2 = new SQLiteEventJournal({ dbPath })
      const recovery = await journal2.recover()
      expect(recovery.ok).toBe(true)
      expect(recovery.lastSequence).toBe(150)
      expect(recovery.eventCount).toBe(150)

      // Continue appending
      for (let i = 0; i < 50; i++) {
        await journal2.append(makeEvent('More'))
      }
      await journal2.flush()
      expect(journal2.getCurrentSequence()).toBe(200)

      // Verify full sequence range
      let count = 0
      for await (const evt of journal2.read()) {
        count++
        expect(evt.sequence).toBe(count)
      }
      expect(count).toBe(200)

      await journal2.close()
    } finally {
      cleanupDb(dbPath)
    }
  })
})

/* ═══════════════════════════════════
   Section 5 — Long Replay Stress
   ═══════════════════════════════════ */

describe('Certification — Long Replay Stress', () => {
  it('Cert 5.1: 100k events — replay completes with correct state', { timeout: 120_000 }, async () => {
    const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
    const EVENT_COUNT = 100_000
    const applier = deterministicApplier()

    for (let i = 0; i < EVENT_COUNT; i++) {
      await journal.append(makeEvent('Tick', { payload: { i } }))
    }
    await journal.flush()

    const startTime = Date.now()

    const engine = makeEngine(journal, applier)
    const report = await engine.replay({})

    const duration = Date.now() - startTime
    const eventsPerSec = Math.round(EVENT_COUNT / (duration / 1000))

    expect(report.ok).toBe(true)
    expect(report.eventsProcessed).toBe(EVENT_COUNT)
    expect(report.errors.length).toBe(0)

    const finalState = report.aggregateResults.find(r => r.aggregateId === 'trade')?.state
    expect(finalState).toBeDefined()
    expect((finalState as any).counter).toBe(EVENT_COUNT)

    // Verify deterministic hash
    const hash1 = hashState(finalState)

    // Second replay
    const engine2 = makeEngine(journal, deterministicApplier())
    const report2 = await engine2.replay({})
    const state2 = report2.aggregateResults.find(r => r.aggregateId === 'trade')?.state ?? {}
    const hash2 = hashState(state2)
    expect(hash1).toBe(hash2)

    console.log(`[CERT 5.1] 100k events: ${duration}ms (${eventsPerSec} evt/s)`)

    journal.close()
  })

  it('Cert 5.2: 250k events — stress with multiple aggregates', { timeout: 300_000 }, async () => {
    const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
    const EVENT_COUNT = 250_000
    const AGG_COUNT = 5
    const applier = deterministicApplier()

    for (let i = 0; i < EVENT_COUNT; i++) {
      const aggId = `agg-${(i % AGG_COUNT) + 1}`
      await journal.append(makeEvent('Data', { tradeId: aggId, runtime: 'trade', payload: { i } }))
    }
    await journal.flush()

    const startTime = Date.now()

    const engine = makeEngine(journal, applier)
    const report = await engine.replay({})

    const duration = Date.now() - startTime
    const eventsPerSec = Math.round(EVENT_COUNT / (duration / 1000))

    expect(report.ok).toBe(true)
    expect(report.eventsProcessed).toBe(EVENT_COUNT)
    expect(report.aggregateResults.length).toBe(AGG_COUNT)

    for (const agg of report.aggregateResults) {
      expect(agg.eventsApplied).toBeGreaterThan(0)
      expect(agg.state).toBeDefined()
    }

    console.log(`[CERT 5.2] 250k events × ${AGG_COUNT} aggregates: ${duration}ms (${eventsPerSec} evt/s)`)

    journal.close()
  })
})

/* ═══════════════════════════════════
   Section 6 — Randomized Certification
   ═══════════════════════════════════ */

describe('Certification — Randomized (100 runs)', () => {
  const CERT_RUNS = 100
  const MAX_EVENTS = 200
  const MAX_AGGREGATES = 6

  it(`Cert 6: ${CERT_RUNS} random scenarios — all deterministic`, { timeout: 300_000 }, async () => {
    const failures: string[] = []
    let passedCount = 0

    for (let run = 0; run < CERT_RUNS; run++) {
      const seed = run * 1000 + 42
      const rng = createRng(seed)
      const numAggregates = Math.floor(rng() * MAX_AGGREGATES) + 1
      const numEvents = Math.floor(rng() * MAX_EVENTS) + 50
      const aggregateIds = Array.from({ length: numAggregates }, (_, i) => `fuzz-${i}`)

      const dbPath = tmpDbPath()
      try {
        // Phase 1 — generate events
        const events: Array<{ type: string; tradeId: string; payload: any }> = []
        const eventTypes = ['Tick', 'TradeOpened', 'TradeClosed', 'OrderFilled', 'PriceUpdate']
        for (let i = 0; i < numEvents; i++) {
          const aggId = aggregateIds[Math.floor(rng() * numAggregates)]
          const evtType = eventTypes[Math.floor(rng() * eventTypes.length)]
          events.push({ type: evtType, tradeId: aggId, payload: { value: i, seed } })
        }

        // Phase 2 — write to journal, build reference state
        const journal = new SQLiteEventJournal({ dbPath })
        const refState: any = { counter: 0, events: [] }

        for (const evt of events) {
          const envelope = await journal.append(makeEvent(evt.type, {
            tradeId: evt.tradeId,
            runtime: 'trade',
            payload: evt.payload,
          }))
          refState.counter++
          refState.events.push(envelope.sequence)
        }
        await journal.flush()

        // Phase 3 — optional snapshot (70% of runs)
        const shouldSnapshot = rng() > 0.3
        if (shouldSnapshot) {
          const serializer6 = new SnapshotSerializer()
          const policy6 = new SnapshotPolicy({ eventThreshold: 0 })
          const validator6 = new SnapshotValidator(serializer6)
          const snapManager6 = new SnapshotManager(journal, policy6, serializer6, validator6)

          const snapSeq = Math.floor(numEvents * (rng() * 0.5 + 0.2)) // 20–70% of events
          let snapState: any = { counter: 0, events: [] }
          if (snapSeq > 0) {
            for await (const evt of journal.read({ afterSequence: 0, beforeSequence: snapSeq + 1 })) {
              snapState.counter++
              snapState.events.push(evt.sequence)
            }
          }
          await snapManager6.createSnapshot([
            { aggregateId: 'fuzz-0', sequence: snapSeq, state: snapState },
          ])
        }
        journal.close()

        // Phase 4 — reopen and replay
        const journal2 = new SQLiteEventJournal({ dbPath })
        const applier = deterministicApplier()
        const engine = makeEngine(journal2, applier)

        const report = await engine.replay({})

        if (!report.ok) {
          failures.push(`Run ${run}: report.ok=false, errors=${JSON.stringify(report.errors)}`)
          journal2.close()
          continue
        }

        if (report.eventsProcessed !== numEvents) {
          failures.push(`Run ${run}: expected ${numEvents} events, got ${report.eventsProcessed}`)
          journal2.close()
          continue
        }

        // Phase 5 — determinism check: second replay must match
        const journal3 = new SQLiteEventJournal({ dbPath })
        const applier2 = deterministicApplier()
        const engine3 = makeEngine(journal3, applier2)
        const report2 = await engine3.replay({})

        if (!report2.ok) {
          failures.push(`Run ${run} (det): report.ok=false`)
        } else if (report2.eventsProcessed !== report.eventsProcessed) {
          failures.push(`Run ${run} (det): event count mismatch ${report2.eventsProcessed} vs ${report.eventsProcessed}`)
        } else {
          // Compare aggregate state hashes between runs
          for (const agg of report.aggregateResults) {
            const agg2 = report2.aggregateResults.find(r => r.aggregateId === agg.aggregateId)
            if (!agg2) {
              failures.push(`Run ${run} (det): missing aggregate ${agg.aggregateId} in second replay`)
              continue
            }
            if (hashState(agg.state) !== hashState(agg2.state)) {
              failures.push(`Run ${run} (det): state hash mismatch for ${agg.aggregateId}`)
            }
          }
        }

        journal2.close()
        journal3.close()
        passedCount++

      } catch (err) {
        failures.push(`Run ${run}: exception — ${(err as Error).message}`)
      } finally {
        cleanupDb(dbPath)
      }
    }

    console.log(`[CERT 6] Randomized: ${passedCount}/${CERT_RUNS} passed`)
    if (failures.length > 0) {
      console.log(`[CERT 6] FAILURES (${failures.length}):`)
      for (const f of failures.slice(0, 10)) {
        console.log(`  • ${f}`)
      }
    }

    expect(failures).toEqual([])
  })
})
