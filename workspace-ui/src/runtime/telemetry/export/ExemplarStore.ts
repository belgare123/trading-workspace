/**
 * ExemplarStore.ts — Exemplar storage for linking metrics to trace IDs
 *
 * Exemplars allow Grafana to jump from a metric data point directly
 * to the related trace in Tempo. Each exemplar stores:
 *   - metric name + value
 *   - traceId + spanId
 *   - timestamp
 *   - optional labels
 *
 * Sampling: stores the latest N exemplars per metric, dropping oldest.
 *
 * @since 6.4.0
 */

import { randomUUID } from 'node:crypto'

/* ── Types ── */

export interface Exemplar {
  /** Metric name (e.g. 'gateway_request_latency_ms') */
  metricName: string
  /** Metric value at the time of exemplar */
  value: number
  /** Trace ID for Grafana → Tempo linking */
  traceId: string
  /** Span ID for deep linking */
  spanId: string
  /** Timestamp in milliseconds */
  timestamp: number
  /** Optional labels to scope the exemplar */
  labels?: Record<string, string>
}

/* ── Configuration ── */

export interface ExemplarStoreConfig {
  /** Max exemplars per metric (default: 10) */
  maxPerMetric: number
  /** Global max exemplars (default: 1000) */
  maxTotal: number
  /** Sampling probability [0..1] — 1 = sample every data point (default: 0.1) */
  samplingRate: number
}

const DEFAULT_CONFIG: ExemplarStoreConfig = {
  maxPerMetric: 10,
  maxTotal: 1000,
  samplingRate: 0.1,
}

/* ── Store ── */

export class ExemplarStore {
  private config: ExemplarStoreConfig
  /** metricName → Exemplar[] (ring buffer) */
  private store = new Map<string, Exemplar[]>()
  private total = 0

  constructor(config?: Partial<ExemplarStoreConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Record an exemplar if sampling decides to keep it.
   * Returns true if stored, false if skipped (sampling or full).
   */
  record(metricName: string, value: number, traceId: string, spanId: string, labels?: Record<string, string>): boolean {
    // Sampling gate
    if (Math.random() > this.config.samplingRate) return false

    // Global cap
    if (this.total >= this.config.maxTotal) {
      // Drop oldest
      this._dropOldest()
    }

    const exemplar: Exemplar = {
      metricName,
      value,
      traceId,
      spanId,
      timestamp: Date.now(),
      labels,
    }

    let bucket = this.store.get(metricName)
    if (!bucket) {
      bucket = []
      this.store.set(metricName, bucket)
    }

    // Per-metric cap — drop oldest
    if (bucket.length >= this.config.maxPerMetric) {
      bucket.shift()
      this.total--
    }

    bucket.push(exemplar)
    this.total++
    return true
  }

  /** Get all exemplars for a metric */
  getForMetric(metricName: string): readonly Exemplar[] {
    return this.store.get(metricName) ?? []
  }

  /** Get all exemplars across all metrics */
  getAll(): readonly Exemplar[] {
    const result: Exemplar[] = []
    for (const bucket of this.store.values()) {
      result.push(...bucket)
    }
    return result
  }

  /** Get exemplar count for health metrics */
  get count(): number {
    return this.total
  }

  /** Get count per metric for health monitoring */
  getPerMetricCounts(): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const [name, bucket] of this.store) {
      counts[name] = bucket.length
    }
    return counts
  }

  /** Clear all exemplars */
  clear(): void {
    this.store.clear()
    this.total = 0
  }

  /** Reset configuration */
  resetConfig(config: Partial<ExemplarStoreConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /* ── Private ── */

  private _dropOldest(): void {
    let oldestTs = Infinity
    let oldestMetric = ''
    let oldestIdx = -1

    for (const [name, bucket] of this.store) {
      const first = bucket[0]
      if (first && first.timestamp < oldestTs) {
        oldestTs = first.timestamp
        oldestMetric = name
        oldestIdx = 0
      }
    }

    if (oldestIdx >= 0) {
      const bucket = this.store.get(oldestMetric)
      bucket?.splice(oldestIdx, 1)
      this.total--
      if (bucket?.length === 0) {
        this.store.delete(oldestMetric)
      }
    }
  }
}

/** Global exemplar store singleton */
export const exemplarStore = new ExemplarStore()
