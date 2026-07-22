/**
 * telemetry/index.ts — Telemetry subsystem barrel
 *
 * @since 6.4.0
 */

export { TelemetryRuntime, telemetryRuntime, getTelemetryRuntime } from './TelemetryRuntime'
export type { TelemetryRuntimeConfig, TelemetryRuntimeHealth } from './TelemetryRuntime'

export {
  MetricMapper,
  sliKindToPrometheus,
  TelemetryExporter,
  PrometheusExporter,
  OpenTelemetryExporter,
  setOtelAdapter,
  getOtelAdapter,
  resolveTraceExemplar,
  traceSpanToOtel,
  startTracedSpan,
  ExporterRegistry,
  exporterRegistry,
  setExporterRegistry,
  registryHealth,
  initResourceAttributes,
  getResourceAttributes,
  toPrometheusLabels,
  toOtelAttributes,
  mergeLabels,
  ExemplarStore,
  exemplarStore,
} from './export'

export type {
  MetricMapping,
  MappedMetricEntry,
  PrometheusMetricKind,
  OTelInstrumentKind,
  ExporterHealth,
  PrometheusExporterConfig,
  OtelAdapter,
  OtelMetricRecorder,
  OtelSpan,
  OtelTracer,
  ExporterRegistryConfig,
  ResourceAttributes,
  Exemplar,
  ExemplarStoreConfig,
} from './export'
