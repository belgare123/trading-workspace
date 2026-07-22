/**
 * ChaosTrace tests — models, runtime, metrics, health, integration
 *
 * Sprint 6.6.2a
 *
 * @since 6.6.2a
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SeededRandom } from '../SeededRandom'
import { FailureInjectionScope, TimeoutRule, LatencyRule, ConnectionRefusedRule, RateLimitRule } from '../InjectionRule'
import { FailureInjector } from '../FailureInjector'
import { wrapFetch } from '../WrappedFetch'
import { CompositeFailureObserver } from '../IFailureObserver'
import { ChaosTraceRuntime } from '../ChaosTraceRuntime'
import { ChaosTraceMetrics } from '../ChaosTraceMetrics'
import { ChaosTraceHealth } from '../ChaosTraceHealth'
import { TraceEventJournal, nextChaosTraceId, computeSeverity } from '../ChaosTrace'
import type { ChaosTrace, ChaosTraceEvent } from '../ChaosTrace'

// ════════════════════════════════════════════
// ChaosTrace model
// ════════════════════════════════════════════

describe('ChaosTrace models', () => {
  it('nextChaosTraceId generates unique IDs', () => {
    const id1 = nextChaosTraceId()
    const id2 = nextChaosTraceId()
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^chaos-\d+-\d+$/)
  })

  it('TraceEventJournal appends and returns events', () => {
    const journal = new TraceEventJournal('test-trace-1')
    expect(journal.events).toHaveLength(0)

    journal.append('started', 'Injection started')
    journal.append('effect', 'Latency 500ms applied', { durationMs: 500 })
    journal.append('finished', 'Request completed')

    expect(journal.events).toHaveLength(3)
    expect(journal.events[0].phase).toBe('started')
    expect(journal.events[0].traceId).toBe('test-trace-1')
    expect(journal.events[1].data).toEqual({ durationMs: 500 })
  })

  it('TraceEventJournal.toJSON is serialisable', () => {
    const journal = new TraceEventJournal('json-test')
    journal.append('started', 'begin')
    const json = journal.toJSON()
    expect(json.traceId).toBe('json-test')
    expect(json.events).toHaveLength(1)
    expect(JSON.parse(JSON.stringify(json))).toEqual(json)
  })

  it('TraceEventJournal.timeline returns readonly events', () => {
    const journal = new TraceEventJournal('readonly-test')
    journal.append('started', 'begin')
    const timeline = journal.timeline
    expect(timeline).toHaveLength(1)
    expect(timeline[0].phase).toBe('started')
  })

  it('ChaosTrace supports partial fields (traceId, strategyId, orderId, symbol)', () => {
    const trace: ChaosTrace = {
      id: 'partial-test',
      traceId: 'trace-abc',
      strategyId: 'strat-1',
      orderId: 'order-42',
      symbol: 'XRPUSDT',
      ruleId: 'rule-1',
      scope: FailureInjectionScope.ORDERS,
      actionType: 'timeout',
      startedAt: Date.now(),
      status: 'running',
    }
    expect(trace.traceId).toBe('trace-abc')
    expect(trace.strategyId).toBe('strat-1')
    expect(trace.orderId).toBe('order-42')
    expect(trace.symbol).toBe('XRPUSDT')
    expect(trace.scope).toBe(FailureInjectionScope.ORDERS)
  })

  it('ChaosTrace supports correlationBridge fields', () => {
    const trace: ChaosTrace = {
      id: 'corr-test',
      traceId: 'trace-abc',
      correlationTraceId: 'corr-xyz',
      ruleId: 'rule-1',
      scope: FailureInjectionScope.ORDERS,
      actionType: 'timeout',
      startedAt: Date.now(),
      status: 'running',
    }
    expect(trace.correlationTraceId).toBe('corr-xyz')
    expect(trace.traceId).toBe('trace-abc')
  })

  it('ChaosTrace supports replay cursor fields', () => {
    const trace: ChaosTrace = {
      id: 'replay-test',
      ruleId: 'rule-1',
      scope: FailureInjectionScope.ORDERS,
      actionType: 'timeout',
      startedAt: Date.now(),
      status: 'failed',
      error: 'connection lost',
      replayCursor: 'seq-12345@2026-07-22T22:00:00Z',
      snapshotSequence: 42,
    }
    expect(trace.replayCursor).toBe('seq-12345@2026-07-22T22:00:00Z')
    expect(trace.snapshotSequence).toBe(42)
  })

  it('ChaosTrace supports severity field', () => {
    const trace: ChaosTrace = {
      id: 'sev-test',
      ruleId: 'rule-1',
      scope: FailureInjectionScope.GLOBAL,
      actionType: 'connection_refused',
      startedAt: Date.now(),
      status: 'failed',
      severity: 'critical',
    }
    expect(trace.severity).toBe('critical')
  })
})

// ════════════════════════════════════════════
// computeSeverity
// ════════════════════════════════════════════

describe('computeSeverity', () => {
  it('returns critical for safeMode/breakerOpened', () => {
    expect(computeSeverity({ actionType: 'latency', scope: FailureInjectionScope.ORDERS, safeMode: true })).toBe('critical')
    expect(computeSeverity({ actionType: 'latency', scope: FailureInjectionScope.ORDERS, breakerOpened: true })).toBe('critical')
  })

  it('returns critical for connection_refused and disconnect', () => {
    expect(computeSeverity({ actionType: 'connection_refused', scope: FailureInjectionScope.ORDERS })).toBe('critical')
    expect(computeSeverity({ actionType: 'disconnect', scope: FailureInjectionScope.ORDERS })).toBe('critical')
  })

  it('returns critical for GLOBAL timeout', () => {
    expect(computeSeverity({ actionType: 'timeout', scope: FailureInjectionScope.GLOBAL })).toBe('critical')
  })

  it('returns error for ORDERS/positions timeout', () => {
    expect(computeSeverity({ actionType: 'timeout', scope: FailureInjectionScope.ORDERS })).toBe('error')
    expect(computeSeverity({ actionType: 'timeout', scope: FailureInjectionScope.POSITIONS })).toBe('error')
  })

  it('returns error for packet_loss', () => {
    expect(computeSeverity({ actionType: 'packet_loss', scope: FailureInjectionScope.MARKET_DATA })).toBe('error')
  })

  it('returns error for rate_limit on ORDERS/positions', () => {
    expect(computeSeverity({ actionType: 'rate_limit', scope: FailureInjectionScope.ORDERS })).toBe('error')
  })

  it('returns warning for rate_limit on MARKET_DATA', () => {
    expect(computeSeverity({ actionType: 'rate_limit', scope: FailureInjectionScope.MARKET_DATA })).toBe('warning')
  })

  it('returns warning for latency >5s', () => {
    expect(computeSeverity({ actionType: 'latency', scope: FailureInjectionScope.MARKET_DATA, durationMs: 6000 })).toBe('warning')
  })

  it('returns info for latency <5s', () => {
    expect(computeSeverity({ actionType: 'latency', scope: FailureInjectionScope.MARKET_DATA, durationMs: 100 })).toBe('info')
  })

  it('returns info for malformed_response', () => {
    expect(computeSeverity({ actionType: 'malformed_response', scope: FailureInjectionScope.MARKET_DATA })).toBe('info')
  })

  it('returns error for partial_response on ORDERS/positions', () => {
    expect(computeSeverity({ actionType: 'partial_response', scope: FailureInjectionScope.ORDERS })).toBe('error')
  })

  it('returns warning for partial_response on MARKET_DATA', () => {
    expect(computeSeverity({ actionType: 'partial_response', scope: FailureInjectionScope.MARKET_DATA })).toBe('warning')
  })
})

// ════════════════════════════════════════════
// ChaosTraceRuntime
// ════════════════════════════════════════════

describe('ChaosTraceRuntime', () => {
  let runtime: ChaosTraceRuntime

  beforeEach(() => {
    runtime = new ChaosTraceRuntime({ maxCompletedTraces: 10 })
  })

  it('starts empty', () => {
    expect(runtime.activeCount).toBe(0)
    expect(runtime.totalTraces).toBe(0)
    expect(runtime.getActiveTraces()).toHaveLength(0)
    expect(runtime.getCompletedTraces()).toHaveLength(0)
  })

  it('registers a running trace via onChaosTrace', () => {
    const trace: ChaosTrace = {
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), status: 'running',
    }
    runtime.onChaosTrace(trace)
    expect(runtime.activeCount).toBe(1)
    expect(runtime.totalTraces).toBe(1)
    expect(runtime.getActiveTraces()).toHaveLength(1)
    expect(runtime.getActiveTrace('t1')).toBeDefined()
    expect(runtime.getActiveTrace('t1')!.ruleId).toBe('r1')
  })

  it('moves trace to completed on terminal status', () => {
    runtime.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now(), status: 'running',
    })
    expect(runtime.activeCount).toBe(1)

    runtime.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now(), finishedAt: Date.now(), status: 'completed',
    })
    expect(runtime.activeCount).toBe(0)
    expect(runtime.getCompletedTraces()).toHaveLength(1)
    expect(runtime.totalTraces).toBe(1)
  })

  it('handles failed and cancelled status', () => {
    // Register as running first
    runtime.onChaosTrace({
      id: 't-fail', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), status: 'running',
    })
    runtime.onChaosTrace({
      id: 't-cancel', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), status: 'running',
    })

    // Mark as failed / cancelled
    runtime.onChaosTrace({
      id: 't-fail', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), status: 'failed', error: 'connection refused',
    })
    runtime.onChaosTrace({
      id: 't-cancel', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), status: 'cancelled',
    })

    expect(runtime.activeCount).toBe(0)
    expect(runtime.getCompletedTraces()).toHaveLength(2)
    const failed = runtime.getCompletedTraces().find(t => t.id === 't-fail')
    expect(failed?.status).toBe('failed')
    expect(failed?.error).toBe('connection refused')
    const cancelled = runtime.getCompletedTraces().find(t => t.id === 't-cancel')
    expect(cancelled?.status).toBe('cancelled')
  })

  it('appends events via onChaosEvent', () => {
    runtime.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now(), status: 'running',
    })
    runtime.onChaosEvent({
      traceId: 't1', timestamp: Date.now(), phase: 'started', message: 'started',
    })
    runtime.onChaosEvent({
      traceId: 't1', timestamp: Date.now(), phase: 'effect', message: 'latency 500ms',
    })
    expect(runtime.getTraceEvents('t1')).toHaveLength(2)
    expect(runtime.getTraceEvents('t1')[1].phase).toBe('effect')
    expect(runtime.getJournal('t1')).toBeDefined()
  })

  it('getTraceEvents returns empty for unknown trace', () => {
    expect(runtime.getTraceEvents('unknown')).toHaveLength(0)
  })

  it('getActiveTrace returns undefined for unknown trace', () => {
    expect(runtime.getActiveTrace('unknown')).toBeUndefined()
  })

  it('enforces max completed traces limit', () => {
    const small = new ChaosTraceRuntime({ maxCompletedTraces: 2 })
    for (let i = 0; i < 5; i++) {
      small.onChaosTrace({
        id: `t${i}`, ruleId: 'r1', scope: FailureInjectionScope.GLOBAL, actionType: 'timeout',
        startedAt: Date.now(), status: 'running',
      })
      small.onChaosTrace({
        id: `t${i}`, ruleId: 'r1', scope: FailureInjectionScope.GLOBAL, actionType: 'timeout',
        startedAt: Date.now(), finishedAt: Date.now(), status: 'completed',
      })
    }
    // Only last 2 should be retained
    expect(small.getCompletedTraces()).toHaveLength(2)
  })

  it('clearCompleted removes completed traces', () => {
    runtime.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now(), status: 'running',
    })
    runtime.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now(), finishedAt: Date.now(), status: 'completed',
    })
    runtime.onChaosTrace({
      id: 't2', ruleId: 'r1', scope: FailureInjectionScope.MARKET_DATA, actionType: 'timeout',
      startedAt: Date.now(), status: 'running',
    })
    expect(runtime.getCompletedTraces()).toHaveLength(1)
    runtime.clearCompleted()
    expect(runtime.getCompletedTraces()).toHaveLength(0)
    // Active trace should remain
    expect(runtime.activeCount).toBe(1)
  })

  it('reset clears everything', () => {
    runtime.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now(), status: 'running',
    })
    runtime.onChaosTrace({
      id: 't2', ruleId: 'r1', scope: FailureInjectionScope.GLOBAL, actionType: 'timeout',
      startedAt: Date.now(), status: 'running',
    })
    runtime.reset()
    expect(runtime.activeCount).toBe(0)
    expect(runtime.totalTraces).toBe(0)
  })

  it('export returns full incident report for active trace', () => {
    runtime.onChaosTrace({
      id: 't-export', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now(), status: 'running',
    })
    runtime.onChaosEvent({ traceId: 't-export', timestamp: Date.now(), phase: 'started', message: 'start' })
    runtime.onChaosEvent({ traceId: 't-export', timestamp: Date.now(), phase: 'effect', message: 'latency 100ms' })

    const report = runtime.export('t-export')
    expect(report).toBeDefined()
    expect(report!.trace.id).toBe('t-export')
    expect(report!.events).toHaveLength(2)
    expect(report!.durationMs).toBeUndefined() // still running
    expect(report!.eventCount).toBe(2)
    expect(report!.severity).toBeDefined()
  })

  it('export returns full incident report for completed trace', () => {
    runtime.onChaosTrace({
      id: 't-export-done', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now() - 100, status: 'running',
    })
    runtime.onChaosEvent({ traceId: 't-export-done', timestamp: Date.now(), phase: 'started', message: 'start' })
    runtime.onChaosTrace({
      id: 't-export-done', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now() - 100, finishedAt: Date.now(), status: 'completed',
    })

    const report = runtime.export('t-export-done')
    expect(report).toBeDefined()
    expect(report!.durationMs).toBeGreaterThanOrEqual(100)
    expect(report!.eventCount).toBeGreaterThanOrEqual(1)
    expect(report!.severity).toBe('error') // ORDERS timeout → error
  })

  it('export returns undefined for unknown trace', () => {
    expect(runtime.export('unknown-trace')).toBeUndefined()
  })
})

// ════════════════════════════════════════════
// ChaosTraceRuntime stats
// ════════════════════════════════════════════

describe('ChaosTraceRuntime stats', () => {
  it('computes stats from active and completed traces', () => {
    const rt = new ChaosTraceRuntime()
    // Active
    rt.onChaosTrace({
      id: 'a1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), status: 'running',
    })
    rt.onChaosTrace({
      id: 'a2', ruleId: 'r2', scope: FailureInjectionScope.MARKET_DATA, actionType: 'latency',
      startedAt: Date.now(), status: 'running',
    })
    // Completed — register as running, then complete
    rt.onChaosTrace({
      id: 'c1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now() - 100, status: 'running',
    })
    rt.onChaosTrace({
      id: 'c1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now() - 100, finishedAt: Date.now(), status: 'completed',
    })
    rt.onChaosTrace({
      id: 'c2', ruleId: 'r3', scope: FailureInjectionScope.GLOBAL, actionType: 'rate_limit',
      startedAt: Date.now() - 200, status: 'running',
    })
    rt.onChaosTrace({
      id: 'c2', ruleId: 'r3', scope: FailureInjectionScope.GLOBAL, actionType: 'rate_limit',
      startedAt: Date.now() - 200, finishedAt: Date.now(), status: 'completed',
    })

    const s = rt.stats
    expect(s.active).toBe(2)
    expect(s.completed).toBe(2)
    expect(s.total).toBe(4)
    expect(s.byStatus.running).toBe(2)
    expect(s.byStatus.completed).toBe(2)
    expect(s.byScope.orders).toBe(2)
    expect(s.byScope.market_data).toBe(1)
    expect(s.byScope.global).toBe(1)
    expect(s.byAction.timeout).toBe(2)
    expect(s.byAction.latency).toBe(1)
    expect(s.avgDurationMs).toBeGreaterThan(0)
  })

  it('returns 0 for avg duration when no completed traces', () => {
    const rt = new ChaosTraceRuntime()
    rt.onChaosTrace({
      id: 'a1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), status: 'running',
    })
    const s = rt.stats
    expect(s.avgDurationMs).toBe(0)
    expect(s.total).toBe(1)
  })
})

// ════════════════════════════════════════════
// ChaosTraceMetrics
// ════════════════════════════════════════════

describe('ChaosTraceMetrics', () => {
  let metrics: ChaosTraceMetrics

  beforeEach(() => {
    metrics = new ChaosTraceMetrics()
  })

  it('starts with zero counters', () => {
    const snap = metrics.snapshot()
    expect(snap.activeTraces).toBe(0)
    expect(snap.completedTraces).toBe(0)
    expect(snap.failedTraces).toBe(0)
    expect(snap.totalEvents).toBe(0)
  })

  it('counts running traces', () => {
    metrics.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), status: 'running',
    })
    expect(metrics.snapshot().activeTraces).toBe(1)
    expect(metrics.snapshot().completedTraces).toBe(0)
  })

  it('counts completed traces and duration', () => {
    metrics.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now() - 500, status: 'running',
    })
    metrics.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now() - 500, finishedAt: Date.now(), status: 'completed',
    })
    const snap = metrics.snapshot()
    expect(snap.activeTraces).toBe(0)
    expect(snap.completedTraces).toBe(1)
    expect(snap.avgDurationMs).toBeGreaterThanOrEqual(500)
  })

  it('counts failed and cancelled', () => {
    metrics.onChaosTrace({
      id: 'f1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), status: 'failed', error: 'timeout',
    })
    metrics.onChaosTrace({
      id: 'x1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), status: 'cancelled',
    })
    const snap = metrics.snapshot()
    expect(snap.failedTraces).toBe(1)
    expect(snap.cancelledTraces).toBe(1)
  })

  it('tracks max concurrent traces', () => {
    // Active 2
    metrics.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), status: 'running',
    })
    metrics.onChaosTrace({
      id: 't2', ruleId: 'r2', scope: FailureInjectionScope.MARKET_DATA, actionType: 'latency',
      startedAt: Date.now(), status: 'running',
    })
    expect(metrics.snapshot().maxConcurrent).toBe(2)

    // Complete one, max should still be 2
    metrics.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), finishedAt: Date.now(), status: 'completed',
    })
    expect(metrics.snapshot().maxConcurrent).toBe(2)
  })

  it('tracks events', () => {
    metrics.onChaosEvent({
      traceId: 't1', timestamp: Date.now(), phase: 'started', message: 'start',
    })
    metrics.onChaosEvent({
      traceId: 't1', timestamp: Date.now(), phase: 'effect', message: 'effect',
    })
    expect(metrics.snapshot().totalEvents).toBe(2)
  })

  it('reset clears all counters', () => {
    metrics.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now(), status: 'running',
    })
    metrics.onChaosEvent({
      traceId: 't1', timestamp: Date.now(), phase: 'started', message: 'start',
    })
    expect(metrics.snapshot().activeTraces).toBe(1)
    metrics.reset()
    expect(metrics.snapshot().activeTraces).toBe(0)
    expect(metrics.snapshot().totalEvents).toBe(0)
  })
})

// ════════════════════════════════════════════
// ChaosTraceHealth
// ════════════════════════════════════════════

describe('ChaosTraceHealth', () => {
  let runtime: ChaosTraceRuntime
  let health: ChaosTraceHealth

  beforeEach(() => {
    runtime = new ChaosTraceRuntime()
    health = new ChaosTraceHealth(runtime, 50) // 50ms stale threshold
  })

  it('reports healthy with no active traces', () => {
    const result = health.check()
    expect(result.healthy).toBe(true)
    expect(result.activeTraces).toBe(0)
    expect(result.staleTraces).toBe(0)
  })

  it('reports healthy when no traces exceed threshold', () => {
    runtime.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now(), status: 'running',
    })
    const result = health.check()
    expect(result.healthy).toBe(true)
    expect(result.activeTraces).toBe(1)
    expect(result.staleTraces).toBe(0)
  })

  it('reports unhealthy when traces exceed stale threshold', async () => {
    runtime.onChaosTrace({
      id: 'old-trace', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now() - 100, status: 'running',
    })
    // Let enough time pass for the threshold
    await new Promise(r => setTimeout(r, 60))
    const result = health.check()
    expect(result.healthy).toBe(false)
    expect(result.staleTraces).toBe(1)
    expect(result.staleTraceIds).toContain('old-trace')
  }, 5000)

  it('deepCheck returns per-trace details', () => {
    runtime.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now() - 100, status: 'running',
    })
    const result = health.deepCheck()
    expect(result.traces).toHaveLength(1)
    expect(result.traces[0].id).toBe('t1')
    expect(result.traces[0].ruleId).toBe('r1')
    expect(result.traces[0].ageMs).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════
// IFailureObserver — extension with ChaosTrace
// ════════════════════════════════════════════

describe('IFailureObserver extension (ChaosTrace)', () => {
  it('CompositeFailureObserver fans out onChaosTrace', () => {
    const composite = new CompositeFailureObserver()
    const m1 = { onChaosTrace: vi.fn(), observe: vi.fn(), onChaosEvent: vi.fn() }
    const m2 = { onChaosTrace: vi.fn(), observe: vi.fn(), onChaosEvent: vi.fn() }
    composite.add(m1)
    composite.add(m2)

    const trace: ChaosTrace = {
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), status: 'running',
    }
    composite.onChaosTrace(trace)

    expect(m1.onChaosTrace).toHaveBeenCalledWith(trace)
    expect(m2.onChaosTrace).toHaveBeenCalledWith(trace)
  })

  it('CompositeFailureObserver fans out onChaosEvent', () => {
    const composite = new CompositeFailureObserver()
    const events: ChaosTraceEvent[] = []
    composite.add({
      onChaosTrace() {},
      onChaosEvent(e: ChaosTraceEvent) { events.push(e) },
      observe() {},
    })

    const event: ChaosTraceEvent = {
      traceId: 't1', timestamp: Date.now(), phase: 'effect', message: 'test',
    }
    composite.onChaosEvent(event)
    expect(events).toHaveLength(1)
    expect(events[0].phase).toBe('effect')
  })

  it('CompositeFailureObserver swallows observer errors', () => {
    const composite = new CompositeFailureObserver()
    composite.add({
      onChaosTrace() { throw new Error('observer crash') },
      onChaosEvent() {},
      observe() {},
    })
    composite.add({
      onChaosTrace() { /* should still be called */ },
      onChaosEvent() {},
      observe() {},
    })

    // Should not throw
    expect(() => composite.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now(), status: 'running',
    })).not.toThrow()
  })

  it('NoopFailureObserver accepts all methods without throwing', async () => {
    const { NoopFailureObserver } = await import('../IFailureObserver')
    const noop = new NoopFailureObserver()
    expect(() => noop.observe({ type: 'injection_started', timestamp: Date.now() })).not.toThrow()
    expect(() => noop.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'latency',
      startedAt: Date.now(), status: 'running',
    })).not.toThrow()
    expect(() => noop.onChaosEvent({
      traceId: 't1', timestamp: Date.now(), phase: 'started', message: 'test',
    })).not.toThrow()
  })

  it('ChaosTraceRuntime + ChaosTraceMetrics work together via CompositeObserver', () => {
    const composite = new CompositeFailureObserver()
    const runtime = new ChaosTraceRuntime()
    const metrics = new ChaosTraceMetrics()
    composite.add(runtime)
    composite.add(metrics)

    // Simulate what WrappedFetch does
    composite.onChaosTrace({
      id: 't1', ruleId: 'r1', scope: FailureInjectionScope.ORDERS, actionType: 'timeout',
      startedAt: Date.now(), status: 'running',
    })
    composite.onChaosEvent({ traceId: 't1', timestamp: Date.now(), phase: 'started', message: 'start' })
    composite.onChaosEvent({ traceId: 't1', timestamp: Date.now(), phase: 'effect', message: 'timeout' })

    expect(runtime.activeCount).toBe(1)
    expect(runtime.getTraceEvents('t1')).toHaveLength(2)
    expect(metrics.snapshot().activeTraces).toBe(1)
    expect(metrics.snapshot().totalEvents).toBe(2)
  })
})

// ════════════════════════════════════════════
// Integration: WrappedFetch with ChaosTraceRuntime
// ════════════════════════════════════════════

describe('WrappedFetch + ChaosTraceRuntime integration', () => {
  /**
   * Helper: create a mock fetch that returns a 200 OK JSON response.
   */
  function mockFetch(): typeof globalThis.fetch {
    return vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ retCode: 0, result: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  }

  const URL = 'https://api.bybit.com/v5/order/create'

  it('wraps fetch and creates trace on injection', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(new LatencyRule('latency', FailureInjectionScope.ORDERS, 1.0, { durationMs: 5 }))

    const runtime = new ChaosTraceRuntime()
    const wrapped = wrapFetch(mockFetch(), injector, runtime)
    await wrapped(URL, { method: 'POST' })

    // After the wrapped call, there should be a completed trace
    expect(runtime.totalTraces).toBe(1)
    const completed = runtime.getCompletedTraces()
    expect(completed).toHaveLength(1)
    expect(completed[0].scope).toBe(FailureInjectionScope.ORDERS)
    expect(completed[0].actionType).toBe('latency')
    expect(completed[0].status).toBe('completed')
  })

  it('wraps fetch and records timeline events', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(new LatencyRule('latency', FailureInjectionScope.ORDERS, 1.0, { durationMs: 5 }))

    const runtime = new ChaosTraceRuntime()
    const wrapped = wrapFetch(mockFetch(), injector, runtime)
    await wrapped(URL, { method: 'POST' })

    const completed = runtime.getCompletedTraces()
    const events = runtime.getTraceEvents(completed[0].id)
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events[0].phase).toBe('started')
    expect(events.some(e => e.phase === 'effect')).toBe(true)
    expect(events.some(e => e.phase === 'finished')).toBe(true)
  })

  it('no injection creates no trace', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    // No rules
    const runtime = new ChaosTraceRuntime()
    const wrapped = wrapFetch(mockFetch(), injector, runtime)
    await wrapped(URL, { method: 'POST' })

    expect(runtime.totalTraces).toBe(0)
  })

  it('trace includes injected rule details', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(new TimeoutRule('timeout-rule', FailureInjectionScope.ORDERS, 1.0, { durationMs: 0 }))

    const runtime = new ChaosTraceRuntime()
    const wrapped = wrapFetch(mockFetch(), injector, runtime)

    // Timeout never resolves, need a race
    const timeoutPromise = wrapped(URL, { method: 'POST' })
    const result = await Promise.race([
      timeoutPromise,
      new Promise(resolve => setTimeout(resolve, 50)),
    ])

    // The trace was created but never completed (race won before timeout)
    expect(runtime.activeCount).toBeGreaterThanOrEqual(0)
    // At minimum the trace was started
    const all = [...runtime.getActiveTraces(), ...runtime.getCompletedTraces()]
    expect(all.length).toBeGreaterThanOrEqual(1)
  }, 5000)

  it('non-matching scope produces no trace', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(new LatencyRule('latency', FailureInjectionScope.MARKET_DATA, 1.0, { durationMs: 5 }))

    const runtime = new ChaosTraceRuntime()
    const wrapped = wrapFetch(mockFetch(), injector, runtime)
    await wrapped(URL, { method: 'POST' })

    // URL maps to ORDERS scope, rule is on MARKET_DATA → no match → no trace
    expect(runtime.totalTraces).toBe(0)
  })

  it('mocks work with rate_limit action', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(new RateLimitRule('rate', FailureInjectionScope.ORDERS, 1.0, { code: 429, retryAfterMs: 5000 }))

    const runtime = new ChaosTraceRuntime()
    const wrapped = wrapFetch(mockFetch(), injector, runtime)
    const res = await wrapped(URL, { method: 'POST' })

    expect(res.status).toBe(429)
    expect(runtime.totalTraces).toBe(1)
    expect(runtime.getCompletedTraces()[0].status).toBe('completed')
  })

  it('completed trace has computed severity', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(new LatencyRule('latency', FailureInjectionScope.ORDERS, 1.0, { durationMs: 5 }))

    const runtime = new ChaosTraceRuntime()
    const wrapped = wrapFetch(mockFetch(), injector, runtime)
    await wrapped(URL, { method: 'POST' })

    const completed = runtime.getCompletedTraces()
    expect(completed[0].severity).toBe('info') // latency < 5s → info
  })

  it('rate_limit on ORDERS produces error severity', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(new RateLimitRule('rate', FailureInjectionScope.ORDERS, 1.0, { code: 429, retryAfterMs: 5000 }))

    const runtime = new ChaosTraceRuntime()
    const wrapped = wrapFetch(mockFetch(), injector, runtime)
    await wrapped(URL, { method: 'POST' })

    const completed = runtime.getCompletedTraces()
    expect(completed[0].severity).toBe('error') // rate_limit on ORDERS → error
  })

  it('stats includes bySeverity distribution', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(new LatencyRule('latency', FailureInjectionScope.ORDERS, 1.0, { durationMs: 5 }))

    const runtime = new ChaosTraceRuntime()
    const wrapped = wrapFetch(mockFetch(), injector, runtime)
    await wrapped(URL, { method: 'POST' })

    const s = runtime.stats
    expect(s.bySeverity).toBeDefined()
    expect(s.bySeverity!.info).toBe(1)
  })
})
