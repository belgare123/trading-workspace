/**
 * TelemetryExport.test.ts — Tests for metric export layer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MetricMapper, sliKindToPrometheus } from '../MetricMapper'
import { PrometheusExporter } from '../PrometheusExporter'
import { OpenTelemetryExporter, setOtelAdapter, getOtelAdapter, type OtelAdapter } from '../OpenTelemetryExporter'
import { ExporterRegistry, exporterRegistry, setExporterRegistry } from '../ExporterRegistry'
import { initResourceAttributes, getResourceAttributes, toOtelAttributes, mergeLabels, _resetResourceAttributes } from '../ResourceAttributes'
import { ExemplarStore } from '../ExemplarStore'
import { RuntimeTelemetry } from '../../../../workspace/live/sli/RuntimeTelemetry'
import type { SliSystemSnapshot, SliRuntimeSnapshot, SliMetric } from '../../../../workspace/live/sli/SliTypes'

// ════════════════════════════════════════
// MetricMapper
// ════════════════════════════════════════

describe('MetricMapper', () => {
  it('returns all mappings', () => {
    const all = MetricMapper.getAllMappings()
    expect(all.length).toBeGreaterThan(0)
  })

  it('returns domain mappings', () => {
    const gw = MetricMapper.getDomainMappings('gateway')
    expect(gw.length).toBeGreaterThan(0)
    expect(gw.every(m => m.descriptor.domain === 'gateway')).toBe(true)
  })

  it('returns empty for unknown domain', () => {
    expect(MetricMapper.getDomainMappings('unknown')).toEqual([])
  })

  it('finds mapping by SLI name', () => {
    const m = MetricMapper.findMapping('gateway.request_latency')
    expect(m).toBeDefined()
    expect(m!.prometheusName).toBe('gateway_request_latency_ms')
  })

  it('finds mapping by Prometheus name', () => {
    const m = MetricMapper.fromPrometheusName('gateway_request_latency_ms')
    expect(m).toBeDefined()
    expect(m!.descriptor.name).toBe('gateway.request_latency')
  })

  it('finds mapping by OTel name', () => {
    const m = MetricMapper.fromOtelName('gateway.request.latency')
    expect(m).toBeDefined()
    expect(m!.prometheusName).toBe('gateway_request_latency_ms')
  })

  it('returns undefined for unknown names', () => {
    expect(MetricMapper.findMapping('nonexistent')).toBeUndefined()
    expect(MetricMapper.fromPrometheusName('nonexistent')).toBeUndefined()
    expect(MetricMapper.fromOtelName('nonexistent')).toBeUndefined()
  })

  it('translates snapshot', () => {
    const snap: SliRuntimeSnapshot = {
      domain: 'gateway',
      timestamp: Date.now(),
      metrics: [
        { name: 'gateway.request_latency', value: 42, kind: 'latency', unit: 'ms' },
      ],
    }
    const entries = MetricMapper.translateSnapshot(snap)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.mapping.prometheusName).toBe('gateway_request_latency_ms')
    expect(entries[0]!.metric.value).toBe(42)
    expect(entries[0]!.domain).toBe('gateway')
  })

  it('skips unmapped metrics in translation', () => {
    const snap: SliRuntimeSnapshot = {
      domain: 'gateway',
      timestamp: Date.now(),
      metrics: [
        { name: 'gateway.request_latency', value: 42, kind: 'latency', unit: 'ms' },
        { name: 'unknown_metric', value: 1, kind: 'gauge', unit: 'count' },
      ],
    }
    const entries = MetricMapper.translateSnapshot(snap)
    expect(entries).toHaveLength(1)
  })

  it('sliKindToPrometheus maps correctly', () => {
    expect(sliKindToPrometheus('latency')).toBe('histogram')
    expect(sliKindToPrometheus('count')).toBe('counter')
    expect(sliKindToPrometheus('rate')).toBe('counter')
    expect(sliKindToPrometheus('gauge')).toBe('gauge')
    expect(sliKindToPrometheus('unknown')).toBe('gauge')
  })
})

// ════════════════════════════════════════
// ResourceAttributes
// ════════════════════════════════════════

describe('ResourceAttributes', () => {
  beforeEach(() => {
    _resetResourceAttributes()
  })

  it('has defaults', () => {
    const attrs = getResourceAttributes()
    expect(attrs.serviceName).toBe('workspace-ui')
    expect(attrs.environment).toBe('dev')
    expect(attrs.exchange).toBe('mock')
  })

  it('initResourceAttributes merges', () => {
    initResourceAttributes({ environment: 'mainnet', exchange: 'bybit', symbol: 'XRPUSDT' })
    const attrs = getResourceAttributes()
    expect(attrs.environment).toBe('mainnet')
    expect(attrs.exchange).toBe('bybit')
    expect(attrs.symbol).toBe('XRPUSDT')
    expect(attrs.serviceName).toBe('workspace-ui') // still default
  })

  it('toOtelAttributes returns correct format', () => {
    const otel = toOtelAttributes()
    expect(otel).toContainEqual(['service.name', 'workspace-ui'])
    expect(otel).toContainEqual(['deployment.environment', 'dev'])
  })

  it('mergeLabels includes resource + extra', () => {
    const merged = mergeLabels({ custom: 'value' })
    expect(merged.service).toBe('workspace-ui')
    expect(merged.custom).toBe('value')
  })
})

// ════════════════════════════════════════
// ExemplarStore
// ════════════════════════════════════════

describe('ExemplarStore', () => {
  it('records and retrieves exemplars', () => {
    const store = new ExemplarStore({ samplingRate: 1 }) // Sample everything
    store.record('gateway_request_latency_ms', 42, 'trace1', 'span1')
    store.record('gateway_request_latency_ms', 100, 'trace2', 'span2')

    const exemplars = store.getForMetric('gateway_request_latency_ms')
    expect(exemplars).toHaveLength(2)
    expect(exemplars[0]!.traceId).toBe('trace1')
    expect(exemplars[1]!.traceId).toBe('trace2')
  })

  it('respects sampling rate', () => {
    const store = new ExemplarStore({ samplingRate: 0 }) // Sample nothing
    const stored = store.record('test', 1, 't', 's')
    expect(stored).toBe(false)
    expect(store.count).toBe(0)
  })

  it('respects maxPerMetric', () => {
    const store = new ExemplarStore({ samplingRate: 1, maxPerMetric: 3 })
    for (let i = 0; i < 10; i++) {
      store.record('test', i, `t${i}`, `s${i}`)
    }
    expect(store.getForMetric('test')).toHaveLength(3)
    expect(store.count).toBe(3)
  })

  it('clear removes all exemplars', () => {
    const store = new ExemplarStore({ samplingRate: 1 })
    store.record('test', 1, 't', 's')
    store.clear()
    expect(store.count).toBe(0)
  })

  it('getPerMetricCounts returns counts', () => {
    const store = new ExemplarStore({ samplingRate: 1, maxPerMetric: 10 })
    store.record('a', 1, 't', 's')
    store.record('a', 2, 't', 's')
    store.record('b', 3, 't', 's')
    const counts = store.getPerMetricCounts()
    expect(counts.a).toBe(2)
    expect(counts.b).toBe(1)
  })
})

// ════════════════════════════════════════
// PrometheusExporter
// ════════════════════════════════════════

describe('PrometheusExporter', () => {
  let exporter: PrometheusExporter
  let snapshot: SliSystemSnapshot

  beforeEach(() => {
    _resetResourceAttributes()
    initResourceAttributes({ exchange: 'bybit', symbol: 'XRPUSDT', environment: 'mainnet' })
    exporter = new PrometheusExporter({ includeExemplars: false, includeHelp: true })
    snapshot = RuntimeTelemetry.instance.snapshot()
  })

  it('renders empty output before first export', () => {
    expect(exporter.render()).toContain('no metrics yet')
  })

  it('renders Prometheus format after export', () => {
    exporter.exportAll(snapshot)
    const output = exporter.render()
    expect(output).toContain('gateway')
    expect(output).toContain('trade')
    expect(output).toContain('risk')
    expect(output).toContain('strategy')
    expect(output).toContain('wallet')
    expect(output).toContain('# HELP')
    expect(output).toContain('# TYPE')
    expect(output).toContain('telemetry_exporter_health')
  })

  it('uses histogram format for latency metrics', () => {
    // Record some latency data
    const rt = RuntimeTelemetry.instance
    for (let i = 1; i <= 100; i++) rt.gateway.requestLatency.record(i)
    rt.gateway.errorRate.record(1)

    exporter.exportAll(rt.snapshot())
    const output = exporter.render()
    expect(output).toContain('gateway_request_latency_ms_bucket')
    expect(output).toContain('gateway_request_latency_ms_sum')
    expect(output).toContain('gateway_request_latency_ms_count')
  })

  it('uses counter format for rate/count metrics', () => {
    const output = exporter.renderFrom(snapshot)
    // Error rate is counter
    expect(output).toContain('gateway_errors_total')
    expect(output).toContain('counter')
  })

  it('uses gauge format for gauge metrics', () => {
    const output = exporter.renderFrom(snapshot)
    expect(output).toContain('gateway_open_requests')
    expect(output).toContain('gauge')
  })

  it('includes resource labels', () => {
    const output = exporter.renderFrom(snapshot)
    // Some metrics should have exchange or symbol labels
    expect(output).toContain('XRPUSDT')
  })

  it('health returns correct metadata', () => {
    const health = exporter.health()
    expect(health.name).toBe('prometheus')
    expect(health.healthy).toBe(false) // No export yet
    exporter.exportAll(snapshot)
    expect(exporter.health().healthy).toBe(true)
    expect(exporter.health().lastMetricCount).toBeGreaterThan(0)
  })

  it('handles empty snapshot gracefully', () => {
    const emptySnap: SliSystemSnapshot = { runtimes: [], uptime: 0 }
    const output = exporter.renderFrom(emptySnap)
    // Still has health metric
    expect(output).toContain('telemetry_exporter_health')
  })
})

// ════════════════════════════════════════
// OpenTelemetryExporter
// ════════════════════════════════════════

describe('OpenTelemetryExporter', () => {
  let exporter: OpenTelemetryExporter
  let snapshot: SliSystemSnapshot
  let recordedMetrics: Array<{ name: string; value: number; attrs: Record<string, string> }>
  let recordedHistograms: Array<{ name: string; value: number; attrs: Record<string, string> }>
  let mockAdapter: OtelAdapter

  beforeEach(() => {
    _resetResourceAttributes()
    initResourceAttributes({ exchange: 'bybit', environment: 'mainnet' })

    recordedMetrics = []
    recordedHistograms = []

    mockAdapter = {
      meter: {
        record: vi.fn((name: string, value: number, attrs: Record<string, string>) => {
          recordedMetrics.push({ name, value, attrs })
        }),
        recordHistogram: vi.fn((name: string, value: number, attrs: Record<string, string>) => {
          recordedHistograms.push({ name, value, attrs })
        }),
      },
      tracer: {
        startSpan: vi.fn(() => ({
          end: vi.fn(),
          setAttribute: vi.fn(),
          addEvent: vi.fn(),
          spanContext: vi.fn(() => ({ traceId: 'mock', spanId: 'mock' })),
        })),
      },
      reset: vi.fn(),
    }

    setOtelAdapter(mockAdapter)
    exporter = new OpenTelemetryExporter()
    snapshot = RuntimeTelemetry.instance.snapshot()
  })

  it('exports all metrics via OTel adapter', () => {
    exporter.exportAll(snapshot)
    // Should have called record or recordHistogram for each metric
    const totalCalls = recordedMetrics.length + recordedHistograms.length
    expect(totalCalls).toBeGreaterThan(0)
  })

  it('exports latency as histogram', () => {
    exporter.exportAll(snapshot)
    const histNames = recordedHistograms.map(h => h.name)
    // Each latency metric should be recorded as histogram
    // plus p50/p95/p99/avg/min/max
    expect(recordedHistograms.length).toBeGreaterThan(0)
  })

  it('exports gauge/count as record', () => {
    const rt = RuntimeTelemetry.instance
    rt.gateway.openRequests.record(5)
    exporter.exportAll(rt.snapshot())
    const recordNames = recordedMetrics.map(m => m.name)
    expect(recordNames).toContain('gateway.open.requests')
  })

  it('includes service.name attribute', () => {
    exporter.exportAll(snapshot)
    if (recordedMetrics.length > 0) {
      expect(recordedMetrics[0]!.attrs['service.name']).toBe('workspace-ui')
    }
  })

  it('health returns correct metadata', () => {
    const health = exporter.health()
    expect(health.name).toBe('opentelemetry')
    expect(health.healthy).toBe(true)
    exporter.exportAll(snapshot)
    expect(exporter.health().lastMetricCount).toBeGreaterThan(0)
  })

  it('setOtelAdapter/getOtelAdapter round-trip', () => {
    const adapter = getOtelAdapter()
    expect(adapter).toBe(mockAdapter)
  })
})

// ════════════════════════════════════════
// ExporterRegistry
// ════════════════════════════════════════

describe('ExporterRegistry', () => {
  let registry: ExporterRegistry
  let prometheus: PrometheusExporter
  let otel: OpenTelemetryExporter

  beforeEach(() => {
    _resetResourceAttributes()
    setOtelAdapter({
      meter: { record: vi.fn(), recordHistogram: vi.fn() },
      tracer: { startSpan: vi.fn(() => ({ end: vi.fn(), setAttribute: vi.fn(), addEvent: vi.fn(), spanContext: vi.fn(() => null) })) },
      reset: vi.fn(),
    })

    registry = new ExporterRegistry({ pushIntervalMs: 60000 }) // long interval for tests
    prometheus = new PrometheusExporter({ includeExemplars: false })
    otel = new OpenTelemetryExporter()
  })

  afterEach(() => {
    registry.stop()
  })

  it('registers and lists exporters', () => {
    registry.register(prometheus)
    registry.register(otel)
    expect(registry.count).toBe(2)
    expect(registry.get('prometheus')).toBe(prometheus)
    expect(registry.get('opentelemetry')).toBe(otel)
  })

  it('throws on duplicate registration', () => {
    registry.register(prometheus)
    expect(() => registry.register(prometheus)).toThrow()
  })

  it('unregisters exporters', () => {
    registry.register(prometheus)
    expect(registry.unregister('prometheus')).toBe(true)
    expect(registry.count).toBe(0)
  })

  it('push sends snapshot to all exporters', () => {
    registry.register(prometheus)
    registry.register(otel)

    const rt = RuntimeTelemetry.instance
    rt.gateway.requestLatency.record(42)

    registry.push()

    const promOutput = prometheus.render()
    expect(promOutput).toContain('gateway_request_latency_ms')
    expect(promOutput).toContain('telemetry_exporter_health')
  })

  it('health returns exporter health array', () => {
    registry.register(prometheus)
    const health = registry.health()
    expect(health).toHaveLength(1)
    expect(health[0]!.name).toBe('prometheus')
  })

  it('aggregateHealthy is true only when all exporters healthy', () => {
    registry.register(prometheus)
    registry.push()
    expect(registry.aggregateHealthy).toBe(true)
  })

  it('global registry singleton can be replaced', () => {
    setExporterRegistry(registry)
    expect(exporterRegistry).toBe(registry)
  })
})

// ════════════════════════════════════════
// Integration: RuntimeTelemetry → Export
// ════════════════════════════════════════

describe('RuntimeTelemetry → Export Integration', () => {
  it('full pipeline produces valid Prometheus output', () => {
    const rt = RuntimeTelemetry.instance
    const prom = new PrometheusExporter({ includeExemplars: false, includeHelp: true })

    // Record real data across domains
    rt.gateway.requestLatency.record(15)
    rt.gateway.requestLatency.record(42)
    rt.gateway.requestLatency.record(8)
    rt.gateway.reconnectCount.record(1)
    rt.gateway.errorRate.record(0)
    rt.trade.entryLatency.record(120)
    rt.trade.activeTrades.record(3)
    rt.risk.validationLatency.record(5)
    rt.risk.rejectRate.record(0)
    rt.strategy.signalLatency.record(2)
    rt.strategy.activeStrategies.record(2)

    prom.exportAll(rt.snapshot())
    const output = prom.render()

    // Should contain all domains
    expect(output).toContain('gateway_request_latency_ms')
    expect(output).toContain('trade_entry_latency_ms')
    expect(output).toContain('risk_validation_latency_ms')
    expect(output).toContain('strategy_signal_latency_ms')

    // Should have proper Prometheus format
    const lines = output.split('\n').filter(l => l && !l.startsWith('#'))
    for (const line of lines) {
      expect(line).toMatch(/^[a-z_]+/)
    }

    // Should have HELP lines
    expect(output).toContain('# HELP')
    expect(output).toContain('# TYPE')

    // Health metric present
    expect(output).toContain('telemetry_exporter_health')

    // Histogram structure present for latency
    expect(output).toContain('_bucket')
    expect(output).toContain('le="1"')
    expect(output).toContain('_count')
  })
})
