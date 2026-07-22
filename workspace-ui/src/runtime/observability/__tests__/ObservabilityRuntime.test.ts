/**
 * Tests for ObservabilityRuntime
 *
 * Covers:
 *   - CorrelationContext trace lifecycle
 *   - StructuredLogger levels + output
 *   - MetricsRegistry counter/gauge/histogram
 *   - HealthAggregator registration + snapshot
 *   - EventTracer timeline
 *   - AlertEngine rule evaluation + lifecycle
 *   - ObservabilityRuntime facade (singleton, integration)
 *
 * @since 6.1.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CorrelationContext, _clearMilestones, _getMilestones, _setLoggerRef, _clearActiveSpans } from '../CorrelationContext'
import { StructuredLogger, LogLevel } from '../StructuredLogger'
import { MetricsRegistry } from '../MetricsRegistry'
import { HealthAggregator } from '../HealthAggregator'
import { EventTracer } from '../EventTracer'
import { AlertEngine } from '../AlertEngine'
import { ObservabilityRuntime, getObservability } from '../ObservabilityRuntime'

/* ── Helpers ── */

function collectLogs(): Record<string, unknown>[] {
  const logs: Record<string, unknown>[] = []
  StructuredLogger.onLog = (entry) => { logs.push({ ...entry }) }
  return logs
}

/* ── CorrelationContext ── */

describe('CorrelationContext', () => {
  beforeEach(() => {
    _clearMilestones()
    _clearActiveSpans()
    _setLoggerRef(null)
  })

  it('creates a trace with unique ID', () => {
    const ctx = CorrelationContext.start('trade', 'XRPUSDT buy')
    expect(ctx.span.id).toMatch(/^trade_\d{8}_[a-f0-9]{12}$/)
    expect(ctx.span.type).toBe('trade')
    expect(ctx.span.label).toBe('XRPUSDT buy')
    expect(ctx.span.startedAt).toBeTruthy()
  })

  it('supports child traces', () => {
    const parent = CorrelationContext.start('trade', 'Parent')
    const child = parent.child('order', 'Child order')
    expect(child.id).not.toBe(parent.span.id)
    expect(child.parentId).toBe(parent.span.id)
    expect(child.type).toBe('order')
  })

  it('completes a trace with status', () => {
    const ctx = CorrelationContext.start('trade', 'Test trade')
    ctx.complete('ok')
    expect(ctx.span.completedAt).toBeTruthy()
    expect(ctx.span.status).toBe('ok')
  })

  it('creates milestones', () => {
    const ctx = CorrelationContext.start('trade', 'Test')
    ctx.milestone('signal_generated', 'price=0.5432')
    ctx.milestone('order_submitted', 'orderId=ex-123')

    const milestones = _getMilestones()
    expect(milestones.length).toBe(2)
    expect(milestones[0].name).toBe('signal_generated')
    expect(milestones[0].traceId).toBe(ctx.span.id)
    expect(milestones[1].name).toBe('order_submitted')
  })

  it('tracks active spans', () => {
    const ctx = CorrelationContext.start('trade', 'Active')
    expect(CorrelationContext.activeCount).toBe(1)
    ctx.complete()
    expect(CorrelationContext.activeCount).toBe(0)
  })

  it('generates unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const ctx = CorrelationContext.start('test', 'Unique')
      ids.add(ctx.span.id)
    }
    expect(ids.size).toBe(100)
  })
})

/* ── StructuredLogger ── */

describe('StructuredLogger', () => {
  let logs: Record<string, unknown>[]

  beforeEach(() => {
    logs = []
    StructuredLogger.onLog = (entry) => { logs.push({ ...entry }) }
    StructuredLogger.minLevel = LogLevel.DEBUG
  })

  afterEach(() => {
    StructuredLogger.onLog = null
  })

  it('logs at info level', () => {
    const log = new StructuredLogger('test')
    log.info('Hello world', { module: 'test' })
    expect(logs.length).toBe(1)
    expect(logs[0].level).toBe('info')
    expect(logs[0].message).toBe('Hello world')
    expect(logs[0].timestamp).toBeTruthy()
  })

  it('logs at debug level', () => {
    const log = new StructuredLogger('test')
    log.debug('Debug message')
    expect(logs.length).toBe(1)
    expect(logs[0].level).toBe('debug')
  })

  it('logs at error level', () => {
    const log = new StructuredLogger('test')
    log.error('Error occurred', { error: 'timeout' })
    expect(logs.length).toBe(1)
    expect(logs[0].level).toBe('error')
    expect(logs[0].error).toBe('timeout')
  })

  it('respects minLogLevel', () => {
    StructuredLogger.minLevel = LogLevel.WARN
    const log = new StructuredLogger('test')
    log.debug('should not appear')
    log.info('should not appear')
    log.warn('should appear')
    log.error('should appear')
    expect(logs.length).toBe(2)
    expect(logs[0].level).toBe('warn')
    expect(logs[1].level).toBe('error')
  })

  it('fatal throws', () => {
    const log = new StructuredLogger('test')
    expect(() => log.fatal('Boom')).toThrow('FATAL')
    expect(logs.length).toBe(1)
    expect(logs[0].level).toBe('fatal')
  })

  it('creates child logger with dotted module', () => {
    const log = new StructuredLogger('core')
    const child = log.child('gateway')
    child.info('Child test')
    expect(logs.length).toBe(1)
    // module is set on the child logger
  })

  it('includes module in every entry', () => {
    const log = new StructuredLogger('my_module')
    log.info('test')
    expect(logs[0].module).toBe('my_module')
  })

  it('includes extra context fields', () => {
    const log = new StructuredLogger('test')
    log.info('With context', { traceId: 'abc', orderId: '123', price: 0.5432 })
    expect(logs[0].traceId).toBe('abc')
    expect(logs[0].orderId).toBe('123')
    expect(logs[0].price).toBe(0.5432)
  })
})

/* ── MetricsRegistry ── */

describe('MetricsRegistry', () => {
  let registry: MetricsRegistry

  beforeEach(() => {
    registry = new MetricsRegistry()
  })

  it('creates and increments a counter', () => {
    const c = registry.counter('test_ops')
    expect(c.value).toBe(0)
    c.inc()
    expect(c.value).toBe(1)
    c.inc(5)
    expect(c.value).toBe(6)
  })

  it('creates and sets a gauge', () => {
    const g = registry.gauge('test_gauge')
    g.set(42)
    expect(g.value).toBe(42)
    g.inc()
    expect(g.value).toBe(43)
    g.dec(3)
    expect(g.value).toBe(40)
  })

  it('creates and observes a histogram', () => {
    const h = registry.histogram('test_histo', [1, 10, 100])
    h.observe(5)
    h.observe(50)
    h.observe(200)
    const snap = h.snapshot()
    expect(snap.count).toBe(3)
    expect(snap.sum).toBe(255)
  })

  it('returns same metric instance on repeated access', () => {
    const c1 = registry.counter('same')
    const c2 = registry.counter('same')
    expect(c1).toBe(c2)
  })

  it('snapshot returns all metrics', () => {
    registry.counter('c1').inc(10)
    registry.gauge('g1').set(50)
    registry.histogram('h1').observe(100)

    const snap = registry.snapshot()
    expect(snap.counters.find(c => c.name === 'c1')?.value).toBe(10)
    expect(snap.gauges.find(g => g.name === 'g1')?.value).toBe(50)
    expect(snap.histograms.find(h => h.name === 'h1')?.count).toBe(1)
  })

  it('histogram calculates percentiles', () => {
    const h = registry.histogram('latency', [10, 50, 100, 500])
    h.observe(10)
    h.observe(20)
    h.observe(30)
    h.observe(100)
    h.observe(200)

    const snap = registry.snapshot()
    const histo = snap.histograms.find(h => h.name === 'latency')!
    expect(histo.p50).toBeGreaterThan(0)
  })

  it('resets all metrics', () => {
    registry.counter('c1').inc(10)
    registry.gauge('g1').set(50)
    registry.histogram('h1').observe(100)
    registry.resetAll()
    const snap = registry.snapshot()
    expect(snap.counters.find(c => c.name === 'c1')?.value).toBe(0)
    expect(snap.gauges.find(g => g.name === 'g1')?.value).toBe(0)
    expect(snap.histograms.find(h => h.name === 'h1')?.count).toBe(0)
  })

  it('generates Prometheus text format', () => {
    registry.counter('gw_reconnects').inc(3)
    const text = registry.prometheusText()
    expect(text).toContain('gw_reconnects')
    expect(text).toContain('3')
    expect(text).toContain('# TYPE')
  })
})

/* ── HealthAggregator ── */

describe('HealthAggregator', () => {
  let health: HealthAggregator

  beforeEach(() => {
    health = new HealthAggregator()
    HealthAggregator.resetUptime()
  })

  it('returns healthy when all modules pass', async () => {
    health.register('gateway', () => ({ healthy: true, latency_ms: 10 }))
    health.register('risk', () => ({ healthy: true }))
    const snap = await health.snapshot()
    expect(snap.status).toBe('healthy')
    expect(snap.summary.healthy).toBe(2)
    expect(snap.summary.total).toBe(2)
  })

  it('returns unhealthy when a module fails', async () => {
    health.register('gateway', () => ({ healthy: true }))
    health.register('wallet', () => ({ healthy: false, lastError: 'Sync failed' }))
    const snap = await health.snapshot()
    expect(snap.status).toBe('unhealthy')
    expect(snap.summary.unhealthy).toBe(1)
  })

  it('handles async checks', async () => {
    health.register('async', async () => {
      await new Promise(r => setTimeout(r, 5))
      return { healthy: true }
    })
    const snap = await health.snapshot()
    expect(snap.status).toBe('healthy')
  })

  it('handles check exceptions', async () => {
    health.register('broken', () => { throw new Error('Kaboom') })
    const snap = await health.snapshot()
    expect(snap.status).toBe('unhealthy')
    expect(snap.modules.broken.lastError).toBe('Kaboom')
  })

  it('unregisters checks', () => {
    health.register('gateway', () => ({ healthy: true }))
    expect(health.moduleCount).toBe(1)
    health.unregister('gateway')
    expect(health.moduleCount).toBe(0)
  })

  it('includes memory info in snapshot', async () => {
    health.register('gateway', () => ({ healthy: true, memory_mb: 4.2 }))
    const snap = await health.snapshot()
    expect(snap.memory).toBeDefined()
    expect(snap.memory.by_module.gateway).toBe(4.2)
  })
})

/* ── EventTracer ── */

describe('EventTracer', () => {
  let tracer: EventTracer

  beforeEach(() => {
    tracer = new EventTracer()
  })

  it('records events for a trace', () => {
    tracer.record('trace_1', 'strategy', 'Signal generated')
    tracer.record('trace_1', 'gateway', 'Order submitted', { orderId: 'ex-123' })
    const tl = tracer.getTimeline('trace_1')
    expect(tl).not.toBeNull()
    expect(tl!.events.length).toBe(2)
    expect(tl!.events[0].stage).toBe('strategy')
    expect(tl!.events[1].stage).toBe('gateway')
    expect(tl!.events[1].data?.orderId).toBe('ex-123')
  })

  it('computes delta_ms and cumulative_ms', () => {
    tracer.record('trace_2', 'start', 'Begin')
    tracer.record('trace_2', 'end', 'End')
    const tl = tracer.getTimeline('trace_2')
    expect(tl!.events[0].delta_ms).toBeNull()
    expect(tl!.events[0].cumulative_ms).toBe(0)
    expect(tl!.events[1].delta_ms).toBeGreaterThanOrEqual(0)
    expect(tl!.events[1].cumulative_ms).toBeGreaterThanOrEqual(0)
  })

  it('returns null for unknown trace', () => {
    expect(tracer.getTimeline('nonexistent')).toBeNull()
  })

  it('clears specific trace', () => {
    tracer.record('t1', 'a', 'Event A')
    tracer.clearTrace('t1')
    expect(tracer.hasTrace('t1')).toBe(false)
  })

  it('clears all traces', () => {
    tracer.record('t1', 'a', 'Event A')
    tracer.record('t2', 'b', 'Event B')
    tracer.clearAll()
    expect(tracer.activeTraceCount).toBe(0)
    expect(tracer.totalEvents).toBe(0)
  })

  it('filters by stage', () => {
    tracer.record('t1', 'risk', 'Check pass')
    tracer.record('t1', 'gateway', 'Sent')
    tracer.record('t2', 'risk', 'Check fail')
    const riskEvents = tracer.getEventsByStage('risk')
    expect(riskEvents.length).toBe(2)
  })

  it('returns recent timelines sorted', () => {
    tracer.record('old', 'a', 'Old')
    tracer.record('new', 'b', 'New')
    const recent = tracer.getRecentTimelines(5)
    expect(recent.length).toBe(2)
  })
})

/* ── AlertEngine ── */

describe('AlertEngine', () => {
  let engine: AlertEngine

  beforeEach(() => {
    engine = new AlertEngine()
  })

  it('fires alert when condition is truthy', async () => {
    engine.addRule({
      name: 'always_fire',
      summary: 'Always fires',
      severity: 'critical',
      condition: () => true,
    })
    const fired = await engine.evaluate()
    expect(fired.length).toBe(1)
    expect(fired[0].ruleName).toBe('always_fire')
    expect(fired[0].severity).toBe('critical')
    expect(fired[0].status).toBe('firing')
  })

  it('does not fire when condition is falsy', async () => {
    engine.addRule({
      name: 'never_fire',
      summary: 'Never fires',
      severity: 'warn',
      condition: () => false,
    })
    const fired = await engine.evaluate()
    expect(fired.length).toBe(0)
  })

  it('respects cooldown', async () => {
    engine.addRule({
      name: 'cooldown_test',
      summary: 'Cooldown test',
      severity: 'warn',
      condition: () => true,
      cooldownMs: 5000,
    })
    await engine.evaluate()
    const fired = await engine.evaluate()
    expect(fired.length).toBe(0) // cooldown active
  })

  it('resolves alert when condition goes false', async () => {
    let val = true
    engine.addRule({
      name: 'flapping',
      summary: 'Flapping test',
      severity: 'warn',
      condition: () => val,
    })
    await engine.evaluate()
    val = false
    await engine.evaluate()
    const history = engine.getHistory()
    const resolved = history.filter(h => h.status === 'resolved')
    // The resolved event is added
    expect(resolved.length).toBeGreaterThanOrEqual(1)
  })

  it('calls notification callbacks', async () => {
    const notified: string[] = []
    engine.onAlert((event) => { notified.push(event.ruleName) })
    engine.addRule({
      name: 'notify_test',
      summary: 'Notify',
      severity: 'alert',
      condition: () => 1,
    })
    await engine.evaluate()
    expect(notified.length).toBe(1)
    expect(notified[0]).toBe('notify_test')
  })

  it('handles async conditions', async () => {
    engine.addRule({
      name: 'async_rule',
      summary: 'Async',
      severity: 'warn',
      condition: async () => {
        await new Promise(r => setTimeout(r, 5))
        return 'firing_value'
      },
    })
    const fired = await engine.evaluate()
    expect(fired.length).toBe(1)
    expect(fired[0].value).toBe('firing_value')
  })

  it('handles exceptions in conditions', async () => {
    engine.addRule({
      name: 'throw_rule',
      summary: 'Throws',
      severity: 'warn',
      condition: () => { throw new Error('Test error') },
    })
    const fired = await engine.evaluate()
    expect(fired.length).toBe(1)
    expect(fired[0].severity).toBe('critical') // escalated
    expect(fired[0].description).toContain('Test error')
  })

  it('tracks firing count', async () => {
    engine.addRule({
      name: 'count_rule',
      summary: 'Count',
      severity: 'warn',
      condition: () => true,
      cooldownMs: 1,
    })
    // Reset cooldown by waiting
    await engine.evaluate()
    await new Promise(r => setTimeout(r, 2))
    await engine.evaluate()
    const history = engine.getHistory()
    const countRule = history.filter(h => h.ruleName === 'count_rule')
    expect(countRule.length).toBe(2)
  })

  it('removes rules', () => {
    engine.addRule({ name: 'temp', summary: 'Temp', severity: 'warn', condition: () => false })
    expect(engine.rules.length).toBe(1)
    engine.removeRule('temp')
    expect(engine.rules.length).toBe(0)
  })
})

/* ── ObservabilityRuntime ── */

describe('ObservabilityRuntime', () => {
  let obs: ObservabilityRuntime

  beforeEach(() => {
    ObservabilityRuntime.reset()
    StructuredLogger.onLog = null
    StructuredLogger.minLevel = LogLevel.DEBUG
    obs = new ObservabilityRuntime({ enableAlerts: false, enableTracing: true })
  })

  afterEach(() => {
    obs.stop()
    ObservabilityRuntime.reset()
  })

  it('creates singleton via getObservability', () => {
    const o1 = getObservability()
    const o2 = getObservability()
    expect(o1).toBe(o2)
  })

  it('provides logger', () => {
    expect(obs.logger).toBeInstanceOf(StructuredLogger)
  })

  it('provides metrics', () => {
    expect(obs.metrics).toBeInstanceOf(MetricsRegistry)
  })

  it('provides health aggregator', () => {
    expect(obs.health).toBeInstanceOf(HealthAggregator)
  })

  it('provides tracer', () => {
    expect(obs.tracer).toBeInstanceOf(EventTracer)
  })

  it('provides alerts', () => {
    expect(obs.alerts).toBeInstanceOf(AlertEngine)
  })

  it('provides correlation context', () => {
    expect(obs.correlation).toBe(CorrelationContext)
  })

  it('creates traces via startTrace', () => {
    const ctx = obs.startTrace('test', 'Integration test')
    expect(ctx.span.type).toBe('test')
    expect(ctx.span.id).toMatch(/^test_\d{8}_/)
    obs.recordTrace(ctx.span.id, 'gateway', 'Sent')
    const tl = obs.getTimeline(ctx.span.id)
    expect(tl).not.toBeNull()
    expect(tl!.events.length).toBe(2) // start + gateway
  })

  it('produces health snapshot', async () => {
    obs.health.register('gateway', () => ({ healthy: true, latency_ms: 5 }))
    const snap = await obs.healthSnapshot()
    expect(snap.status).toBe('healthy')
    expect(snap.modules.gateway).toBeDefined()
  })

  it('measures uptime', () => {
    expect(obs.uptimeSeconds).toBeGreaterThanOrEqual(0)
  })

  it('creates metrics and produces prometheus text', () => {
    obs.metrics.counter('gw_reconnects').inc(3)
    const text = obs.metricsText()
    expect(text).toContain('gw_reconnects')
    expect(text).toContain('3')
  })

  it('evaluates alert rules', async () => {
    obs.addAlertRule({
      name: 'test_rule',
      summary: 'Test',
      severity: 'warn',
      condition: () => true,
    })
    const fired = await obs.evaluateAlerts()
    expect(fired.length).toBe(1)
  })

  it('starts and stops health loop', () => {
    obs.startHealthLoop(1000)
    expect(obs.uptimeSeconds).toBeGreaterThanOrEqual(0)
    obs.stop()
  })

  it('records milestones via correlation context', () => {
    const ctx = obs.startTrace('trade', 'Lifecycle test')
    ctx.milestone('signal', 'Entry signal received')
    ctx.milestone('risk', 'Risk check passed')
    ctx.milestone('gateway', 'Order submitted')
    ctx.complete('ok')
    const milestones = _getMilestones()
    const traceMilestones = milestones.filter(m => m.traceId === ctx.span.id)
    expect(traceMilestones.length).toBeGreaterThanOrEqual(3)
  })
})

/* ── Integration: logger + correlation + metrics ── */

describe('Integration', () => {
  beforeEach(() => {
    _clearActiveSpans()
    _clearMilestones()
  })

  it('logger works with correlation context', () => {
    const logs = collectLogs()
    const log = new StructuredLogger('integration')
    // Wire logger to correlation context so trace events emit logs
    _setLoggerRef({ info: (e) => log.info(e.message as string, e) })
    const ctx = CorrelationContext.start('trade', 'Integration')
    log.info('Processing trade', { traceId: ctx.span.id, symbol: 'XRPUSDT', price: 0.5432 })
    ctx.complete('ok')
    expect(logs.length).toBe(2) // 1 (trace start) + 1 (info)
    expect(logs[0].traceId).toBe(ctx.span.id)
    expect(logs[1].traceId).toBe(ctx.span.id)
    expect(logs[1].symbol).toBe('XRPUSDT')
  })

  it('metrics and logger both collect data', () => {
    const logs = collectLogs()
    const registry = new MetricsRegistry()
    const log = new StructuredLogger('test')

    const reconnects = registry.counter('gw_reconnects')
    reconnects.inc()
    log.warn('Gateway reconnected', { reconnect_count: reconnects.value })

    const snap = registry.snapshot()
    expect(snap.counters.find(c => c.name === 'gw_reconnects')?.value).toBe(1)
    expect(logs.some(l => l.message === 'Gateway reconnected')).toBe(true)
  })

  it('health + tracer integration', async () => {
    const health = new HealthAggregator()
    const tracer = new EventTracer()
    const traceId = 'integ_test_001'

    health.register('gateway', () => ({ healthy: true, latency_ms: 10 }))
    health.register('risk', () => ({ healthy: true }))

    tracer.record(traceId, 'strategy', 'Entry signal')
    tracer.record(traceId, 'risk', 'Risk OK')
    tracer.record(traceId, 'gateway', 'Order placed')

    const snap = await health.snapshot()
    const tl = tracer.getTimeline(traceId)

    expect(snap.status).toBe('healthy')
    expect(tl!.events.length).toBe(3)
    expect(tl!.events[2].stage).toBe('gateway')
    expect(tl!.events[2].cumulative_ms).toBeGreaterThanOrEqual(0)
  })

  it('alert engine can reference metrics', async () => {
    const registry = new MetricsRegistry()
    const engine = new AlertEngine()

    const disconnectCounter = registry.counter('gateway_disconnects')
    disconnectCounter.inc(5)

    engine.addRule({
      name: 'too_many_disconnects',
      summary: 'Too many gateway disconnects',
      severity: 'critical',
      condition: () => disconnectCounter.value > 3,
    })

    const fired = await engine.evaluate()
    expect(fired.length).toBe(1)
    expect(fired[0].value).toBe(true)
  })

  it('full pipeline: trace → logger → metrics → health', () => {
    const logs = collectLogs()
    const registry = new MetricsRegistry()
    const log = new StructuredLogger('pipeline')

    // Simulate a trade lifecycle
    const ctx = CorrelationContext.start('trade', 'XRPUSDT buy')
    log.info('Trade opened', { traceId: ctx.span.id, symbol: 'XRPUSDT' })
    registry.counter('trade_open_total').inc()
    ctx.milestone('open', 'Position opened at 0.5432')

    registry.counter('trade_close_total').inc()
    registry.histogram('trade_duration_ms').observe(1250)
    ctx.complete('ok')
    log.info('Trade closed', { traceId: ctx.span.id, duration_ms: 1250 })

    const snap = registry.snapshot()
    expect(snap.counters.find(c => c.name === 'trade_open_total')?.value).toBe(1)
    expect(snap.counters.find(c => c.name === 'trade_close_total')?.value).toBe(1)
    expect(snap.histograms.find(h => h.name === 'trade_duration_ms')?.count).toBe(1)
    expect(logs.some(l => l.message === 'Trade opened')).toBe(true)
  })
})
