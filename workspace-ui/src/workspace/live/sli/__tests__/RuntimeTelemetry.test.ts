/**
 * RuntimeTelemetry.test.ts — Tests for SLI core
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SliCollector } from '../SliCollector'
import { RuntimeTelemetry, runtimeTelemetry } from '../RuntimeTelemetry'
import type { SliDescriptor } from '../SliTypes'

const LATENCY_DESC: SliDescriptor = {
  name: 'test.latency',
  label: 'Test Latency',
  kind: 'latency',
  unit: 'ms',
  domain: 'gateway',
}

const COUNTER_DESC: SliDescriptor = {
  name: 'test.count',
  label: 'Test Count',
  kind: 'count',
  unit: 'count',
  domain: 'gateway',
}

const GAUGE_DESC: SliDescriptor = {
  name: 'test.gauge',
  label: 'Test Gauge',
  kind: 'gauge',
  unit: 'count',
  domain: 'gateway',
}

const RATE_DESC: SliDescriptor = {
  name: 'test.rate',
  label: 'Test Rate',
  kind: 'rate',
  unit: 'req/s',
  domain: 'gateway',
}

describe('SliCollector', () => {
  it('records and reads a single value', () => {
    const c = new SliCollector(LATENCY_DESC)
    c.record(42)
    expect(c.lastValue).toBe(42)
    expect(c.lastUpdated).toBeGreaterThan(0)
    expect(c.sampleCount).toBe(1)
  })

  it('computes percentiles', () => {
    const c = new SliCollector(LATENCY_DESC)
    for (let i = 1; i <= 100; i++) c.record(i)
    const snap = c.snapshot()
    expect(snap.percentiles).toBeDefined()
    expect(snap.percentiles!.p50).toBe(50)
    expect(snap.percentiles!.p95).toBe(95)
    expect(snap.percentiles!.p99).toBe(99)
    expect(snap.percentiles!.min).toBe(1)
    expect(snap.percentiles!.max).toBe(100)
    expect(snap.percentiles!.mean).toBe(50.5)
  })

  it('handles empty collector', () => {
    const c = new SliCollector(LATENCY_DESC)
    const snap = c.snapshot()
    expect(snap.value).toBe(0)
    expect(snap.percentiles).toBeUndefined()
  })

  it('counts rate for counter metrics', () => {
    const c = new SliCollector(COUNTER_DESC)
    // We can't easily test real rates without time travel,
    // but the snapshot should not crash
    c.record(1)
    const snap = c.snapshot()
    expect(snap.rate1m).toBeDefined()
  })

  it('resets correctly', () => {
    const c = new SliCollector(LATENCY_DESC)
    c.record(42)
    c.reset()
    expect(c.lastValue).toBe(0)
    expect(c.lastUpdated).toBe(0)
    expect(c.sampleCount).toBe(0)
  })

  it('respects maxSamples', () => {
    const c = new SliCollector(LATENCY_DESC, { maxSamples: 5 })
    for (let i = 0; i < 100; i++) c.record(i)
    expect(c.sampleCount).toBeLessThanOrEqual(5)
  })
})

describe('RuntimeTelemetry', () => {
  beforeEach(() => {
    RuntimeTelemetry.resetInstance()
  })

  it('creates all collectors', () => {
    const rt = new RuntimeTelemetry()
    expect(rt.gateway.requestLatency).toBeDefined()
    expect(rt.gateway.requestLatency instanceof SliCollector).toBe(true)
    expect(rt.trade.entryLatency).toBeDefined()
    expect(rt.wallet.freeBalance).toBeDefined()
    expect(rt.risk.validationLatency).toBeDefined()
    expect(rt.strategy.signalLatency).toBeDefined()
  })

  it('snapshot includes all domains', () => {
    const rt = new RuntimeTelemetry()
    const snap = rt.snapshot()
    expect(snap.runtimes).toHaveLength(5)
    const domains = snap.runtimes.map(r => r.domain)
    expect(domains).toContain('gateway')
    expect(domains).toContain('trade')
    expect(domains).toContain('wallet')
    expect(domains).toContain('risk')
    expect(domains).toContain('strategy')
    expect(snap.uptime).toBeGreaterThanOrEqual(0)
  })

  it('records and reads gateway SLIs', () => {
    const rt = new RuntimeTelemetry()
    rt.gateway.requestLatency.record(15)
    rt.gateway.reconnectCount.record(1)
    rt.gateway.openRequests.record(3)

    const snap = rt.domainSnapshot('gateway')!
    expect(snap.domain).toBe('gateway')
    const latencyMetric = snap.metrics.find(m => m.name === 'gateway.request_latency')!
    expect(latencyMetric.value).toBe(15)
    expect(latencyMetric.percentiles!.p50).toBe(15)
    const reconnectMetric = snap.metrics.find(m => m.name === 'gateway.reconnect_count')!
    expect(reconnectMetric.value).toBe(1)
  })

  it('records and reads trade SLIs', () => {
    const rt = new RuntimeTelemetry()
    rt.trade.activeTrades.record(5)
    rt.trade.entryLatency.record(100)

    const snap = rt.domainSnapshot('trade')!
    expect(snap.metrics.find(m => m.name === 'trade.active_trades')!.value).toBe(5)
    expect(snap.metrics.find(m => m.name === 'trade.entry_latency')!.value).toBe(100)
  })

  it('resetAll clears all collectors', () => {
    const rt = new RuntimeTelemetry()
    rt.gateway.requestLatency.record(42)
    rt.risk.rejectRate.record(1)
    rt.resetAll()
    const snap = rt.gateway.requestLatency.snapshot()
    expect(snap.value).toBe(0)
  })

  it('singleton pattern works', () => {
    const i1 = RuntimeTelemetry.instance
    const i2 = RuntimeTelemetry.instance
    expect(i1).toBe(i2)
  })

  it('proxy singleton works', () => {
    expect(runtimeTelemetry.gateway).toBeDefined()
    expect(runtimeTelemetry.trade).toBeDefined()
  })

  it('domainSnapshot returns null for unknown domain', () => {
    const rt = new RuntimeTelemetry()
    expect(rt.domainSnapshot('unknown')).toBeNull()
  })
})
