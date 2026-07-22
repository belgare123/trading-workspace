/**
 * SliCollector.ts — Per-metric SLI collector with sliding window
 *
 * Collects measurements in a sliding time window and computes
 * percentiles, rates, and aggregates on demand.
 *
 * @since 6.3.0
 */

import type { SliDescriptor, SliMetricSnapshot, SliPercentiles, SliMeasurement } from './SliTypes'

/* ── Config ── */

export interface SliCollectorConfig {
  /** Max measurements kept per metric (default: 1000) */
  maxSamples?: number
  /** Window size in ms for latency/histogram (default: 60000 = 1 min) */
  windowMs?: number
  /** Bucket count for histogram-style metrics (default: 10) */
  bucketCount?: number
}

const DEFAULTS: Required<SliCollectorConfig> = {
  maxSamples: 1000,
  windowMs: 60_000,
  bucketCount: 10,
}

/* ── Collector ── */

export class SliCollector {
  private readonly desc: SliDescriptor
  private readonly config: Required<SliCollectorConfig>
  private values: number[] = []
  private timestamps: number[] = []
  private _lastValue = 0
  private _lastUpdated = 0

  /** Optional: rate tracking (counters in last 1m / 5m) */
  private rateTimestamps: number[] = []

  constructor(desc: SliDescriptor, config?: SliCollectorConfig) {
    this.desc = desc
    this.config = { ...DEFAULTS, ...config }
  }

  get name(): string { return this.desc.name }
  get kind(): string { return this.desc.kind }
  get domain(): string { return this.desc.domain }
  get label(): string { return this.desc.label }
  get lastValue(): number { return this._lastValue }
  get lastUpdated(): number { return this._lastUpdated }

  /* ── Record ── */

  /** Record a single measurement */
  record(value: number, labels?: Record<string, string>): void {
    const now = Date.now()
    this._lastValue = value
    this._lastUpdated = now

    // Prune old values outside window
    this._prune(now)

    if (this.desc.kind === 'count' || this.desc.kind === 'rate') {
      // Counters and rates track timestamps for rate computation
      this.rateTimestamps.push(now)
      this._trimArray(this.rateTimestamps, 5000)
    } else {
      // Latency, gauge, histogram track values
      this.values.push(value)
      this.timestamps.push(now)
      this._trimArray(this.values, this.config.maxSamples)
      this._trimArray(this.timestamps, this.config.maxSamples)
    }
  }

  /** Increment current value (for gauge semantics) */
  inc(delta = 1): void {
    this.record(this._lastValue + delta)
  }

  /** Decrement current value (for gauge semantics) */
  dec(delta = 1): void {
    this.record(this._lastValue - delta)
  }

  /** Set value directly (for gauge semantics) */
  set(v: number): void {
    this.record(v)
  }

  /* ── Snapshot ── */

  /** Get current snapshot of this metric */
  snapshot(): SliMetricSnapshot {
    const now = Date.now()
    this._prune(now)

    const base: SliMetricSnapshot = {
      name: this.desc.name,
      label: this.desc.label,
      kind: this.desc.kind,
      unit: this.desc.unit,
      domain: this.desc.domain,
      value: this._lastValue,
      lastUpdated: this._lastUpdated,
    }

    if ((this.desc.kind === 'latency' || this.desc.kind === 'histogram') && this.values.length > 0) {
      base.percentiles = this._computePercentiles()
    }

    if (this.desc.kind === 'rate' || this.desc.kind === 'count') {
      base.rate1m = this._computeRate(60_000, now)
      base.rate5m = this._computeRate(300_000, now)
    }

    return base
  }

  /** Reset all data */
  reset(): void {
    this.values = []
    this.timestamps = []
    this.rateTimestamps = []
    this._lastValue = 0
    this._lastUpdated = 0
  }

  /** Current sample count */
  get sampleCount(): number {
    return Math.max(this.values.length, this.rateTimestamps.length)
  }

  /* ── Private ── */

  private _prune(now: number): void {
    const cutoff = now - this.config.windowMs
    while (this.timestamps.length > 0 && this.timestamps[0]! < cutoff) {
      this.values.shift()
      this.timestamps.shift()
    }
    while (this.rateTimestamps.length > 0 && this.rateTimestamps[0]! < cutoff) {
      this.rateTimestamps.shift()
    }
  }

  private _computePercentiles(): SliPercentiles {
    const sorted = [...this.values].sort((a, b) => a - b)
    const len = sorted.length
    if (len === 0) return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, mean: 0, count: 0 }

    const sum = sorted.reduce((a, b) => a + b, 0)
    const p = (pct: number) => {
      const idx = Math.min(Math.ceil(len * pct / 100) - 1, len - 1)
      return sorted[Math.max(0, idx)]!
    }
    return {
      min: sorted[0]!,
      max: sorted[len - 1]!,
      mean: sum / len,
      count: len,
      p50: p(50),
      p75: p(75),
      p90: p(90),
      p95: p(95),
      p99: p(99),
    }
  }

  private _computeRate(windowMs: number, now: number): number {
    const cutoff = now - windowMs
    let count = 0
    for (let i = this.rateTimestamps.length - 1; i >= 0; i--) {
      if (this.rateTimestamps[i]! >= cutoff) count++
      else break
    }
    return windowMs > 0 ? Math.round((count / windowMs) * 1000 * 100) / 100 : 0
  }

  private _trimArray(arr: unknown[], max: number): void {
    while (arr.length > max) {
      arr.shift()
    }
  }
}
