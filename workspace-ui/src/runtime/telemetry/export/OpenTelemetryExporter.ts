/**
 * OpenTelemetryExporter.ts — RuntimeTelemetry → OpenTelemetry SDK bridge
 *
 * Exports SLI metrics via OpenTelemetry SDK (Metrics API).
 * Uses MetricMapper to translate SLI → OTel instruments.
 *
 * Does NOT hardcode any OTel SDK API — instead uses a thin adapter
 * interface (OtelAdapter) so the SDK can be swapped without touching
 * the exporter.
 *
 * @since 6.4.0
 */

import { TelemetryExporter, type ExporterHealth } from './TelemetryExporter'
import type { SliSystemSnapshot, SliRuntimeSnapshot, SliMetric } from '../../../workspace/live/sli/SliTypes'
import { MetricMapper, type MetricMapping } from './MetricMapper'
import { getResourceAttributes, toOtelAttributes, mergeLabels } from './ResourceAttributes'
import { exemplarStore } from './ExemplarStore'
import { CorrelationContext } from '../../observability/CorrelationContext'
import type { TraceSpan } from '../../observability/CorrelationContext'

/* ── OTel Adapter interface ── */

export interface OtelMetricRecorder {
  record(name: string, value: number, attributes: Record<string, string>, exemplar?: { traceId: string; spanId: string }): void
  recordHistogram(name: string, value: number, attributes: Record<string, string>, exemplar?: { traceId: string; spanId: string }): void
}

export interface OtelSpan {
  end(): void
  setAttribute(key: string, value: string): void
  addEvent(name: string, attributes?: Record<string, string>): void
  spanContext(): { traceId: string; spanId: string } | null
}

export interface OtelTracer {
  startSpan(name: string, attributes?: Record<string, string>): OtelSpan
}

export interface OtelAdapter {
  readonly meter: OtelMetricRecorder
  readonly tracer: OtelTracer
  reset(): void
}

/* ── In-memory fallback (no-op when no OTel SDK) ── */

class NoopOtelAdapter implements OtelAdapter {
  readonly meter: OtelMetricRecorder = {
    record: () => {},
    recordHistogram: () => {},
  }
  readonly tracer: OtelTracer = {
    startSpan: () => ({
      end: () => {},
      setAttribute: () => {},
      addEvent: () => {},
      spanContext: () => null,
    }),
  }
  reset(): void {}
}

/* ── State ── */

let _otelAdapter: OtelAdapter = new NoopOtelAdapter()
let _lastExportTime = 0
let _lastMetricCount = 0
let _droppedCount = 0
let _exportTotal = 0

/**
 * Set the active OTel adapter.
 * Call once during startup with the real SDK adapter.
 */
export function setOtelAdapter(adapter: OtelAdapter): void {
  _otelAdapter = adapter
}

/** Get current OTel adapter (for unit tests) */
export function getOtelAdapter(): OtelAdapter {
  return _otelAdapter
}

/* ── TraceBridge helpers ── */

/**
 * Extract traceId from CorrelationContext for exemplar linking.
 * Returns null if no active trace context exists.
 */
export function resolveTraceExemplar(): { traceId: string; spanId: string } | null {
  const active = CorrelationContext.getActiveSpans()
  if (active.length === 0) return null
  const latest = active[active.length - 1]!
  return {
    traceId: latest.id,
    spanId: latest.id, // CorrelationContext uses id for both
  }
}

/* ── Exporter ── */

export class OpenTelemetryExporter extends TelemetryExporter {
  readonly name = 'opentelemetry'

  exportAll(snapshot: SliSystemSnapshot): void {
    for (const runtime of snapshot.runtimes) {
      const entries = MetricMapper.translateSnapshot(runtime)
      for (const { mapping, metric } of entries) {
        this._exportMetric(mapping, metric, runtime)
      }
    }
    _lastExportTime = Date.now()
    _lastMetricCount = snapshot.runtimes.reduce((sum, r) => sum + r.metrics.length, 0)
    _exportTotal++
  }

  health(): ExporterHealth {
    return {
      name: 'opentelemetry',
      healthy: true,
      lastExport: _lastExportTime,
      lastMetricCount: _lastMetricCount,
      queueDepth: 0,
      droppedMetrics: _droppedCount,
      message: _exportTotal > 0 ? `Exported ${_exportTotal} times` : 'No export yet',
    }
  }

  /* ── Private ── */

  private _exportMetric(mapping: MetricMapping, metric: SliMetric, runtime: SliRuntimeSnapshot): void {
    const attrs: Record<string, string> = this._buildAttrs(mapping)
    const exemplar = resolveTraceExemplar()

    switch (mapping.otelKind) {
      case 'counter':
        _otelAdapter.meter.record(mapping.otelName, metric.value, attrs, exemplar ?? undefined)
        break
      case 'gauge':
        _otelAdapter.meter.record(mapping.otelName, metric.value, attrs, exemplar ?? undefined)
        break
      case 'histogram':
        _otelAdapter.meter.recordHistogram(mapping.otelName, metric.value, attrs, exemplar ?? undefined)
        // Also record percentiles as separate gauge metrics for Grafana panels
        if (metric.percentiles) {
          const p = metric.percentiles
          _otelAdapter.meter.record(`${mapping.otelName}.p50`, p.p50, attrs)
          _otelAdapter.meter.record(`${mapping.otelName}.p95`, p.p95, attrs)
          _otelAdapter.meter.record(`${mapping.otelName}.p99`, p.p99, attrs)
          _otelAdapter.meter.record(`${mapping.otelName}.avg`, p.mean, attrs)
          _otelAdapter.meter.record(`${mapping.otelName}.min`, p.min, attrs)
          _otelAdapter.meter.record(`${mapping.otelName}.max`, p.max, attrs)
        }
        break
    }

    // Store exemplar for Prometheus
    if (exemplar) {
      exemplarStore.record(
        mapping.prometheusName,
        metric.value,
        exemplar.traceId,
        exemplar.spanId,
        attrs,
      )
    }
  }

  private _buildAttrs(mapping: MetricMapping): Record<string, string> {
    const attrs: Record<string, string> = {
      'service.name': getResourceAttributes().serviceName,
      'deployment.environment': getResourceAttributes().environment,
    }
    // Add resource labels from mapping
    for (const key of mapping.resourceLabels) {
      const a = getResourceAttributes() as Record<string, string>
      const val = a[key]
      if (val && val !== 'all') {
        attrs[key] = val
      }
    }
    return attrs
  }
}

/* ── TraceBridge ── */

/**
 * Convert a CorrelationContext span into an OTel span.
 * Returns null if no OTel adapter or no active trace.
 */
export function traceSpanToOtel(span: TraceSpan): OtelSpan | null {
  const otelSpan = _otelAdapter.tracer.startSpan(span.label, {
    'trace.type': span.type,
    'trace.id': span.id,
  })
  if (span.parentId) {
    otelSpan.setAttribute('parent.trace.id', span.parentId)
  }
  for (const [key, val] of Object.entries(span.tags)) {
    otelSpan.setAttribute(`tag.${key}`, val)
  }
  return otelSpan
}

/**
 * Create an OTel span from a CorrelationContext.start() call.
 * Returns the otel span wrapper. Call .end() when the trace completes.
 */
export function startTracedSpan(type: string, label?: string): OtelSpan | null {
  const ctx = CorrelationContext.start(type, label)
  return traceSpanToOtel(ctx.span)
}
