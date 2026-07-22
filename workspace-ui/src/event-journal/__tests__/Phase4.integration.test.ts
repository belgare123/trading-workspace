// __tests__/Phase4.integration.test.ts
// Phase 4.8 + Phase 5 — End-to-end recovery integration tests
// Uses real SQLiteEventJournal to verify full recovery pipeline through ReplayEngine

import { describe, it, expect, vi } from 'vitest'
import { SQLiteEventJournal } from '../SQLiteEventJournal'
import { createEventEnvelope } from '../EventEnvelope'
import type { EventEnvelope } from '../EventEnvelope'
import { SnapshotManager } from '../SnapshotManager'
import { SnapshotPolicy } from '../SnapshotPolicy'
import { SnapshotSerializer } from '../SnapshotSerializer'
import { SnapshotValidator } from '../SnapshotValidator'
import { SnapshotRecovery } from '../SnapshotRecovery'
import { ReplayEngine } from '../ReplayEngine'
import { EventStream } from '../EventStream'
import { ReplayCursor } from '../ReplayCursor'
import type { EventApplier } from '../EventApplier'
import { SnapshotMetrics } from '../SnapshotMetrics'
import { SnapshotHealth } from '../SnapshotHealth'
import { v4 as uuidv4 } from 'uuid'

/* ─── Helpers ─── */

function makeEvent(runtime: string, overrides: Partial<Parameters<typeof createEventEnvelope>[0]> = {}) {
  return createEventEnvelope({
    traceId: `trace-${Math.random().toString(36).slice(2, 8)}`,
    runtime,
    type: 'Event',
    payload: {},
    ...overrides,
  })
}

function createMetrics(): SnapshotMetrics {
  return new SnapshotMetrics()
}

function makeRecovery(journal: SQLiteEventJournal, manager: SnapshotManager, applier: EventApplier): SnapshotRecovery {
  const eventStream = new EventStream(journal)
  const cursor = new ReplayCursor(0)
  const engine = new ReplayEngine(journal, eventStream, applier, cursor)
  return new SnapshotRecovery(journal, manager, engine)
}

/** Create an event applier that tracks aggregate balance and positions */
function createTradeApplier(): { applier: EventApplier; getState: (id: string) => any } {
  const states = new Map<string, any>()

  const applier: EventApplier = {
    apply: vi.fn().mockImplementation((id: string, state: any, events: any[]) => {
      let current = { ...state }
      for (const evt of events) {
        switch (evt.type) {
          case 'TradeOpened':
            current.trades = [...(current.trades ?? []), evt.payload]
            current.balance = (current.balance ?? 0) + (evt.payload?.amount ?? 0)
            break
          case 'TradeClosed':
            current.trades = (current.trades ?? []).filter(
              (t: any) => t.tradeId !== evt.payload?.tradeId,
            )
            current.lastClosedTrade = evt.payload?.tradeId
            break
          case 'PositionChanged':
            current.position = { ...(current.position ?? {}), ...evt.payload }
            current.positionChangeCount = (current.positionChangeCount ?? 0) + 1
            break
          case 'WalletCommitted':
            current.balance = (current.balance ?? 0) + (evt.payload?.amount ?? 0)
            current.committedCount = (current.committedCount ?? 0) + 1
            break
          default:
            current.lastEventType = evt.type
        }
      }
      states.set(id, current)
      return current
    }),
  }

  return {
    applier,
    getState: (id: string) => states.get(id),
  }
}

/* ─═══ Integration Tests ═══─ */

describe('Phase 4 — End-to-End Recovery', () => {
  describe('Scenario 1: Trade → Snapshot → Crash → Restart → Replay → State identical', () => {

    it('recovers identical state after crash with snapshot replay', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const metrics = createMetrics()
      const policy = new SnapshotPolicy()
      const serializer = new SnapshotSerializer()
      const validator = new SnapshotValidator(serializer)
      const manager = new SnapshotManager(journal, policy, serializer, validator, metrics)
      const { applier } = createTradeApplier()

      // Phase 1: Normal operation — append events
      const event1 = makeEvent('trade', { type: 'TradeOpened', payload: { tradeId: 't1', amount: 100, symbol: 'XRPUSDT' } })
      const event2 = makeEvent('trade', { type: 'TradeOpened', payload: { tradeId: 't2', amount: 200, symbol: 'BTCUSDT' } })
      const event3 = makeEvent('wallet', { type: 'WalletCommitted', payload: { amount: 500 } })

      await journal.append(event1)
      await journal.append(event2)
      await journal.append(event3)
      await journal.flush()

      // Create a snapshot at this point
      manager.createSnapshot([
        {
          aggregateId: 'trade',
          state: { balance: 300, trades: [{ tradeId: 't1' }, { tradeId: 't2' }] },
          sequence: 3,
        },
        {
          aggregateId: 'wallet',
          state: { balance: 500 },
          sequence: 3,
        },
      ], 'periodic')

      // More events after snapshot (simulate continued operation)
      const event4 = makeEvent('trade', { type: 'TradeClosed', payload: { tradeId: 't1' } })
      const event5 = makeEvent('trade', { type: 'TradeOpened', payload: { tradeId: 't3', amount: 300, symbol: 'ETHUSDT' } })
      await journal.append(event4)
      await journal.append(event5)
      await journal.flush()

      // Record the final expected state after events 4-5 applied
      const expectedTradeState = {
        balance: 600, // 300 + 300 (t3 opened)
        trades: [{ tradeId: 't2' }, { tradeId: 't3' }],
        lastClosedTrade: 't1',
      }

      // Phase 2: CRASH — close journal, create new one
      journal.close()

      // Phase 3: RESTART — fresh journal
      const recoveryJournal = new SQLiteEventJournal({ dbPath: ':memory:' })

      // Re-create the events and snapshot in the recovery journal
      await recoveryJournal.append(event1)
      await recoveryJournal.append(event2)
      await recoveryJournal.append(event3)
      await recoveryJournal.flush()

      // Re-save the snapshot
      const recoveryManager = new SnapshotManager(
        recoveryJournal, policy, serializer, validator, metrics,
      )

      recoveryManager.createSnapshot([
        {
          aggregateId: 'trade',
          state: { balance: 300, trades: [{ tradeId: 't1' }, { tradeId: 't2' }] },
          sequence: 3,
        },
        {
          aggregateId: 'wallet',
          state: { balance: 500 },
          sequence: 3,
        },
      ], 'periodic')

      // Add the events that happened AFTER the snapshot
      await recoveryJournal.append(event4)
      await recoveryJournal.append(event5)
      await recoveryJournal.flush()

      // Phase 4: FULL RECOVERY via SnapshotRecovery → ReplayEngine
      const recovery = makeRecovery(recoveryJournal, recoveryManager, applier)
      const report = await recovery.recover()

      // Verify recovery report
      expect(report.ok).toBe(true)
      expect(report.replayedEvents).toBe(2)
      expect(report.totalAggregates).toBe(2)
      expect(report.recoveredAggregates).toBe(2)

      // Verify trade state matches expected
      const tradeAgg = report.aggregates.find(a => a.aggregateId === 'trade')
      expect(tradeAgg).toBeDefined()
      expect(tradeAgg!.valid).toBe(true)
      expect(tradeAgg!.state).toMatchObject(expectedTradeState)

      // Verify wallet state
      const walletAgg = report.aggregates.find(a => a.aggregateId === 'wallet')
      expect(walletAgg).toBeDefined()
      expect(walletAgg!.valid).toBe(true)
      expect(walletAgg!.state).toMatchObject({ balance: 500 })

      recoveryJournal.close()
    })
  })

  describe('Scenario 2: 1000 events → Snapshot → Restart → Replay last events → State identical', () => {

    it('recovers identical state after replaying events from snapshot cursor', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const metrics = createMetrics()
      const policy = new SnapshotPolicy()
      const serializer = new SnapshotSerializer()
      const validator = new SnapshotValidator(serializer)
      const manager = new SnapshotManager(journal, policy, serializer, validator, metrics)

      // Generate 1000 events with a simple counter
      const EVENT_COUNT = 1000
      const SNAPSHOT_AT = 700
      const events: EventEnvelope[] = []

      for (let i = 0; i < EVENT_COUNT; i++) {
        const event = makeEvent('trade', {
          type: 'CounterUpdated',
          payload: { value: i + 1 },
        })
        events.push(event)
        await journal.append(event)
      }
      await journal.flush()

      // Snapshot state: just a counter
      const snapshotState = { counter: SNAPSHOT_AT }

      // Create snapshot at SNAPSHOT_AT
      manager.createSnapshot([{
        aggregateId: 'trade',
        state: snapshotState,
        sequence: SNAPSHOT_AT,
      }], 'periodic')

      // Close journal (simulate restart)
      journal.close()

      // Phase: RESTART with recovery
      const recoveryJournal = new SQLiteEventJournal({ dbPath: ':memory:' })

      // Re-insert all events
      for (const evt of events) {
        await recoveryJournal.append(evt)
      }
      await recoveryJournal.flush()

      // Re-create snapshot
      const recoveryManager = new SnapshotManager(
        recoveryJournal, policy, serializer, validator, metrics,
      )
      recoveryManager.createSnapshot([{
        aggregateId: 'trade',
        state: snapshotState,
        sequence: SNAPSHOT_AT,
      }], 'periodic')

      // Custom applier that tracks a simple counter
      const counterApplier: EventApplier = {
        apply: vi.fn().mockImplementation((id: string, state: any, evts: any[]) => {
          let current = { ...state }
          for (const evt of evts) {
            current.counter = (current.counter ?? 0) + 1
          }
          return current
        }),
      }

      // Recover via SnapshotRecovery → ReplayEngine
      const recovery = makeRecovery(recoveryJournal, recoveryManager, counterApplier)
      const report = await recovery.recover()

      // Verify we replayed the remaining events (1000 - 700 = 300)
      expect(report.replayedEvents).toBe(EVENT_COUNT - SNAPSHOT_AT)
      expect(report.ok).toBe(true)

      // Verify final state
      const tradeAgg = report.aggregates.find(a => a.aggregateId === 'trade')
      expect(tradeAgg).toBeDefined()
      expect(tradeAgg!.valid).toBe(true)
      expect(tradeAgg!.state.counter).toBe(EVENT_COUNT) // counter = snapshot + replayed events

      recoveryJournal.close()
    })
  })

  describe('Scenario 3: Health and metrics after recovery', () => {

    it('produces valid health report and metrics after full cycle', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const metrics = createMetrics()
      const policy = new SnapshotPolicy()
      const serializer = new SnapshotSerializer()
      const validator = new SnapshotValidator(serializer)
      const manager = new SnapshotManager(journal, policy, serializer, validator, metrics)

      // Insert events and create snapshot
      const e1 = makeEvent('trade', { type: 'TradeOpened', payload: { tradeId: 't1', amount: 100 } })
      const e2 = makeEvent('trade', { type: 'TradeOpened', payload: { tradeId: 't2', amount: 200 } })
      await journal.append(e1)
      await journal.append(e2)
      await journal.flush()

      manager.createSnapshot([{
        aggregateId: 'trade',
        state: { balance: 300, trades: ['t1', 't2'] },
        sequence: 2,
      }], 'periodic')

      // Health check
      const health = new SnapshotHealth(journal, metrics, validator)
      const report = health.report()

      expect(report.healthy).toBe(true)
      expect(report.snapshotCount).toBe(1)
      expect(report.validation).toBe('ok')
      expect(report.lastSnapshotSequence).toBe(2)
      expect(report.metrics.createTotal).toBe(1)

      // Metrics snapshot
      const metricSnap = metrics.snapshot()
      expect(metricSnap.createTotal).toBe(1)
      expect(metricSnap.durationMs.length).toBeGreaterThanOrEqual(1)

      journal.close()
    })
  })

  describe('Scenario 4: Recovery with corrupted snapshot (validation catch)', () => {

    it('catches corrupted snapshot during recovery and reports error', async () => {
      const journal = new SQLiteEventJournal({ dbPath: ':memory:' })
      const metrics = createMetrics()
      const policy = new SnapshotPolicy()
      const serializer = new SnapshotSerializer()
      const validator = new SnapshotValidator(serializer)
      const manager = new SnapshotManager(journal, policy, serializer, validator, metrics)

      // Insert events
      const e1 = makeEvent('trade', { type: 'TradeOpened', payload: { tradeId: 't1', amount: 100 } })
      await journal.append(e1)
      await journal.flush()

      // Save snapshot
      manager.createSnapshot([{
        aggregateId: 'trade',
        state: { balance: 100 },
        sequence: 1,
      }], 'test')

      // Corrupt the snapshot directly via journal
      const originalSnap = journal.loadSnapshot('trade')!
      journal.saveSnapshot({
        ...originalSnap,
        checksum: '0000000000000000000000000000000000000000000000000000000000000000',
        payload: JSON.stringify({ balance: 99999 }), // Tampered data
      })

      // Perform recovery via SnapshotRecovery → ReplayEngine
      const recoveryManager = new SnapshotManager(
        journal, policy, serializer, validator, metrics,
      )
      const { applier } = createTradeApplier()
      const recovery = makeRecovery(journal, recoveryManager, applier)
      const report = await recovery.recover()

      // Should detect corruption
      expect(report.ok).toBe(false)
      expect(report.errors.length).toBeGreaterThan(0)
      expect(report.errors.some(e => e.includes('Checksum mismatch') || e.includes('snapshot'))).toBe(true)

      journal.close()
    })
  })
})
