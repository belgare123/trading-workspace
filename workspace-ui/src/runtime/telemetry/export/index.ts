/**
 * export/index.ts — Telemetry export layer barrel
 *
 * Export layer sits between RuntimeTelemetry (single source of truth)
 * and external observability backends (Prometheus, OpenTelemetry, OTLP).
 *
 * Usage:
 *   import { MetricMapper, PrometheusExporter, ExporterRegistry }
 *
 * @since 6.4.0
 */

export { MetricMapper } from './MetricMapper'
export type { MetricMapping, MappedMetricEntry, PrometheusMetricKind, OTelInstrumentKind } from './MetricMapper'
export { sliKindToPrometheus } from './MetricMapper'

export { TelemetryExporter } from './TelemetryExporter'
export type { ExporterHealth } from './TelemetryExporter'

export { PrometheusExporter } from './PrometheusExporter'
export type { PrometheusExporterConfig } from './PrometheusExporter'

export { OpenTelemetryExporter, setOtelAdapter, getOtelAdapter, resolveTraceExemplar, traceSpanToOtel, startTracedSpan } from './OpenTelemetryExporter'
export type { OtelAdapter, OtelMetricRecorder, OtelSpan, OtelTracer } from './OpenTelemetryExporter'

export { ExporterRegistry, exporterRegistry, setExporterRegistry, registryHealth } from './ExporterRegistry'
export type { ExporterRegistryConfig } from './ExporterRegistry'

export { initResourceAttributes, getResourceAttributes, toPrometheusLabels, toOtelAttributes, mergeLabels } from './ResourceAttributes'
export type { ResourceAttributes } from './ResourceAttributes'

export { ExemplarStore, exemplarStore } from './ExemplarStore'
export type { Exemplar, ExemplarStoreConfig } from './ExemplarStore'
