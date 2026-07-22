/**
 * SliTypes.ts — Core SLI types for RuntimeTelemetry
 *
 * SLI = Service Level Indicator — a quantitative measure of some aspect
 * of the service level (latency, throughput, error rate, availability).
 *
 * Each Runtime has its own set of SLIs, grouped by domain.
 *
 * @since 6.3.0
 */

/* ── SLI kinds ── */

/** SLI measurement kind */
export type SliKind = 'latency' | 'count' | 'gauge' | 'rate' | 'histogram'

/* ── SLI descriptors ── */

export interface SliDescriptor {
  /** Unique name (e.g. 'gateway.request_latency') */
  name: string
  /** Human-readable label */
  label: string
  /** Measurement kind */
  kind: SliKind
  /** Unit (ms, req/s, count, %) */
  unit: string
  /** Runtime domain */
  domain: 'gateway' | 'trade' | 'wallet' | 'risk' | 'strategy'
  /** Optional description */
  description?: string
}

/* ── Measurement ── */

export interface SliMeasurement {
  /** SLI name */
  name: string
  /** Timestamp (ms) */
  timestamp: number
  /** Measured value */
  value: number
  /** Optional labels for filtering */
  labels?: Record<string, string>
}

/* ── Window ── */

export interface SliWindow {
  /** Measurement values in the window */
  values: number[]
  /** Timestamps of each measurement */
  timestamps: number[]
  /** Window start (ms epoch) */
  windowStart: number
  /** Window duration (ms) */
  windowMs: number
}

/* ── Latency percentile snapshot ── */

export interface SliPercentiles {
  p50: number
  p75: number
  p90: number
  p95: number
  p99: number
  min: number
  max: number
  mean: number
  count: number
}

/* ── Collector snapshot (one metric) ── */

export interface SliMetricSnapshot {
  name: string
  label: string
  kind: SliKind
  unit: string
  domain: string
  value: number
  lastUpdated: number
  // Only for latency/histogram:
  percentiles?: SliPercentiles
  // Only for rate:
  rate1m?: number
  rate5m?: number
}

/* ── Runtime snapshot (one Runtime) ── */

export interface SliRuntimeSnapshot {
  domain: string
  metrics: SliMetricSnapshot[]
  updatedAt: number
}

/* ── Full telemetry snapshot ── */

export interface TelemetrySnapshot {
  runtimes: SliRuntimeSnapshot[]
  timestamp: string
  uptime: number
}
