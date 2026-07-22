/**
 * MetricsRegistry — Counter, Gauge, Histogram registry.
 *
 * Lightweight in-process metrics collector inspired by Prometheus client API.
 * All metrics are stored in memory and can be:
 *   - Read via snapshot() for /metrics endpoint
 *   - Consumed by EventTracer for runtime timeline
 *   - Cleared periodically for unbounded metrics (trade, order)
 *
 * Types:
 *   Counter — monotonic increment (reconnects, orders, errors)
 *   Gauge   — current value (connected state, queue depth, memory)
 *   Histogram — value distribution (latency P50/P95/P99)
 *
 * Usage:
 *   const metrics = new MetricsRegistry()
 *   const reconnectCounter = metrics.counter('gateway_reconnects', { module: 'gateway' })
 *   reconnectCounter.inc()
 *   reconnectCounter.inc(2)
 *
 * @since 6.1.0
 */

/* ── Metric types ── */

export interface MetricLabel {
  [key: string]: string | number
}

export interface Counter {
  /** Name of this counter */
  readonly name: string
  /** Labels attached */
  readonly labels: readonly MetricLabel[]
  /** Current value */
  readonly value: number
  /** Increment by 1 (or delta) */
  inc(delta?: number): void
  /** Reset to 0 (for periodic clearing) */
  reset(): void
}

export interface Gauge {
  readonly name: string
  readonly labels: readonly MetricLabel[]
  readonly value: number
  /** Set to value */
  set(v: number): void
  /** Increment */
  inc(delta?: number): void
  /** Decrement */
  dec(delta?: number): void
  /** Reset to 0 */
  reset(): void
}

export interface Histogram {
  readonly name: string
  readonly labels: readonly MetricLabel[]
  readonly buckets: readonly number[]
  /** Observe a value (adds to histogram) */
  observe(value: number): void
  /** Snapshot of bucket counts */
  snapshot(): { buckets: Map<string, number>; count: number; sum: number }
  /** Reset all buckets */
  reset(): void
}

/* ── Counter implementation ── */

class CounterImpl implements Counter {
  _value = 0
  readonly labels: MetricLabel[] = []

  constructor(
    readonly name: string,
  ) {}

  inc(delta = 1): void {
    this._value += delta
  }

  reset(): void {
    this._value = 0
  }

  get value(): number {
    return this._value
  }
}

/* ── Gauge implementation ── */

class GaugeImpl implements Gauge {
  _value = 0
  readonly labels: MetricLabel[] = []

  constructor(
    readonly name: string,
  ) {}

  set(v: number): void {
    this._value = v
  }

  inc(delta = 1): void {
    this._value += delta
  }

  dec(delta = 1): void {
    this._value -= delta
  }

  reset(): void {
    this._value = 0
  }

  get value(): number {
    return this._value
  }
}

/* ── Default Prometheus-like buckets ── */

const DEFAULT_BUCKETS = [1, 5, 10, 50, 100, 500, 1000, 5000]

/* ── Histogram implementation ── */

class HistogramImpl implements Histogram {
  readonly buckets: readonly number[]
  readonly labels: MetricLabel[] = []
  private _buckets: Map<string, number>
  private _count = 0
  private _sum = 0

  constructor(
    readonly name: string,
    customBuckets?: number[],
  ) {
    const b = customBuckets ?? DEFAULT_BUCKETS
    this.buckets = [...b]
    this._buckets = new Map(b.map(v => [`le_${v}`, 0]))
    this._buckets.set('le_+Inf', 0)
  }

  observe(value: number): void {
    this._count++
    this._sum += value
    for (const b of this.buckets) {
      if (value <= b) {
        const key = `le_${b}`
        this._buckets.set(key, (this._buckets.get(key) ?? 0) + 1)
      }
    }
  }

  snapshot(): { buckets: Map<string, number>; count: number; sum: number } {
    return { buckets: new Map(this._buckets), count: this._count, sum: this._sum }
  }

  reset(): void {
    this._count = 0
    this._sum = 0
    for (const key of this._buckets.keys()) {
      this._buckets.set(key, 0)
    }
  }
}

/* ── Snapshot types ── */

export interface MetricsSnapshot {
  counters: Array<{ name: string; value: number }>
  gauges: Array<{ name: string; value: number }>
  histograms: Array<{
    name: string
    count: number
    sum: number
    buckets: Record<string, number>
    p50: number
    p95: number
    p99: number
  }>
  timestamp: string
}

/* ── Registry ── */

export class MetricsRegistry {
  private readonly _counters = new Map<string, CounterImpl>()
  private readonly _gauges = new Map<string, GaugeImpl>()
  private readonly _histograms = new Map<string, HistogramImpl>()

  /** Create or retrieve a counter */
  counter(name: string, _labels?: MetricLabel): Counter {
    let c = this._counters.get(name)
    if (!c) {
      c = new CounterImpl(name)
      this._counters.set(name, c)
    }
    return c
  }

  /** Create or retrieve a gauge */
  gauge(name: string, _labels?: MetricLabel): Gauge {
    let g = this._gauges.get(name)
    if (!g) {
      g = new GaugeImpl(name)
      this._gauges.set(name, g)
    }
    return g
  }

  /** Create or retrieve a histogram */
  histogram(name: string, buckets?: number[], _labels?: MetricLabel): Histogram {
    let h = this._histograms.get(name)
    if (!h) {
      h = new HistogramImpl(name, buckets)
      this._histograms.set(name, h)
    }
    return h
  }

  /** Full snapshot for /metrics endpoint */
  snapshot(): MetricsSnapshot {
    const toPercentile = (h: HistogramImpl, pct: number): number => {
      const snap = h.snapshot()
      if (snap.count === 0) return 0
      const target = snap.count * (pct / 100)
      let cumulative = 0
      for (const [key, count] of snap.buckets) {
        cumulative += count
        if (cumulative >= target) {
          const v = key === 'le_+Inf' ? Infinity : Number(key.slice(3))
          return v
        }
      }
      return Infinity
    }

    return {
      counters: Array.from(this._counters.entries()).map(([name, c]) => ({ name, value: c.value })),
      gauges: Array.from(this._gauges.entries()).map(([name, g]) => ({ name, value: g.value })),
      histograms: Array.from(this._histograms.entries()).map(([name, h]) => {
        const snap = h.snapshot()
        const buckets: Record<string, number> = {}
        for (const [k, v] of snap.buckets) {
          buckets[k] = v
        }
        return {
          name,
          count: snap.count,
          sum: snap.sum,
          buckets,
          p50: toPercentile(h, 50),
          p95: toPercentile(h, 95),
          p99: toPercentile(h, 99),
        }
      }),
      timestamp: new Date().toISOString(),
    }
  }

  /** Plain-text Prometheus exposition format for /metrics */
  prometheusText(): string {
    const lines: string[] = []
    lines.push(`# HELP observability_runtime metrics`)
    lines.push(`# TYPE observability_runtime gauge`)
    lines.push(`observability_runtime_uptime_seconds ${Math.floor(process.uptime?.() ?? 0)}`)
    lines.push('')

    for (const [name, c] of this._counters) {
      lines.push(`# HELP ${name} counter`)
      lines.push(`# TYPE ${name} counter`)
      lines.push(`${name} ${c.value}`)
    }
    lines.push('')
    for (const [name, g] of this._gauges) {
      lines.push(`# HELP ${name} gauge`)
      lines.push(`# TYPE ${name} gauge`)
      lines.push(`${name} ${g.value}`)
    }
    lines.push('')
    for (const [name, h] of this._histograms) {
      const snap = h.snapshot()
      lines.push(`# HELP ${name} histogram`)
      lines.push(`# TYPE ${name} histogram`)
      lines.push(`${name}_count ${snap.count}`)
      lines.push(`${name}_sum ${snap.sum}`)
      for (const [bucket, count] of snap.buckets) {
        lines.push(`${name}_bucket{le="${bucket.slice(3)}"} ${count}`)
      }
    }
    lines.push('')
    return lines.join('\n')
  }

  /** Reset all counters (e.g. on session replay) */
  resetAll(): void {
    for (const c of this._counters.values()) c.reset()
    for (const g of this._gauges.values()) g.reset()
    for (const h of this._histograms.values()) h.reset()
  }
}
