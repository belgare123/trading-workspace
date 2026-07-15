/**
 * EventBusBench — benchmark EventBus throughput and latency
 *
 * Tests: 1K, 10K, 50K, 100K, 250K events/sec
 * Metrics: throughput, latency p50/p95/p99, dropped, memory, subscribers, middleware
 *
 * @since 2.0.0
 */

import type { BenchmarkScenario, BenchmarkResult } from '../types'
import { BenchmarkRegistry as BR } from '../BenchmarkRegistry'
import { MetricsCollector } from '../MetricsCollector'

// ── Inline mini EventBus for benchmarking ──────────────────────

type Handler = (event: unknown) => void

class BenchEventBus {
  private handlers = new Map<string, Handler[]>()
  private middlewares: Array<(event: unknown, next: () => void) => void> = []

  use(mw: (event: unknown, next: () => void) => void): void {
    this.middlewares.push(mw)
  }

  on(topic: string, handler: Handler): () => void {
    if (!this.handlers.has(topic)) this.handlers.set(topic, [])
    this.handlers.get(topic)!.push(handler)
    return () => this.off(topic, handler)
  }

  off(topic: string, handler: Handler): void {
    const h = this.handlers.get(topic)
    if (h) this.handlers.set(topic, h.filter((x) => x !== handler))
  }

  emit(topic: string, payload: unknown): void {
    const run = (data: unknown, i: number) => {
      if (i < this.middlewares.length) {
        this.middlewares[i](data, () => run(data, i + 1))
      } else {
        const handlers = this.handlers.get(topic)
        if (handlers) handlers.forEach((h) => h(data))
      }
    }
    run(payload, 0)
  }

  subscriberCount(topic: string): number {
    return this.handlers.get(topic)?.length ?? 0
  }
}

// ── Benchmark logic ────────────────────────────────────────────

const EVENT_LEVELS = [1_000, 10_000, 50_000, 100_000, 250_000] as const

async function runEventBusBench(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  for (const count of EVENT_LEVELS) {
    const bus = new BenchEventBus()
    const collector = new MetricsCollector()

    // Add middleware to test overhead
    bus.use((_event, next) => { next() })
    bus.use((_event, next) => { next() })

    // Subscribe handlers
    const SUBSCRIBERS = 3
    const unsubs: (() => void)[] = []
    for (let h = 0; h < SUBSCRIBERS; h++) {
      unsubs.push(bus.on('bench.event', () => { /* noop */ }))
    }

    collector.start()
    for (let i = 0; i < count; i++) {
      const t0 = performance.now()
      bus.emit('bench.event', { index: i, timestamp: Date.now() })
      collector.record(performance.now() - t0)
    }
    const metrics = collector.stop()

    // Cleanup
    unsubs.forEach((u) => u())

    // Score: 250K events/sec with <1ms p50 = 100
    const throughputScore = Math.min(100, (metrics.throughput / 250_000) * 100)
    const latencyScore = Math.min(100, (1 / (metrics.latency.p50 || 0.001)) * 95)
    const score = Math.round((throughputScore * 0.5 + latencyScore * 0.5) * 10) / 10

    results.push({
      id: `eventbus-${count}`,
      name: `${(count / 1000).toFixed(0)}K Events`,
      description: `Emit ${count.toLocaleString()} events with ${SUBSCRIBERS} subscribers and 2 middleware`,
      category: 'eventbus',
      config: { name: `${count} Events`, description: '', iterations: count, warmupIterations: Math.min(count, 100) },
      metrics,
      success: true,
      timestamp: Date.now(),
      score,
    })
  }

  return results
}

// ── Scenario definition ─────────────────────────────────────────

const scenario: BenchmarkScenario = {
  id: 'eventbus-throughput',
  name: 'EventBus Throughput',
  description: 'Emit 1K, 10K, 50K, 100K, and 250K events with subscribers and middleware',
  category: 'eventbus',
  config: {
    name: 'EventBus Benchmark',
    description: 'Throughput and latency across event volumes',
    iterations: 250_000,
    warmupIterations: 500,
  },
  run: async (): Promise<BenchmarkResult> => {
    const subResults = await runEventBusBench()
    const avgScore = subResults.reduce((s, r) => s + r.score, 0) / subResults.length
    const lastResult = subResults[subResults.length - 1]

    return {
      id: 'eventbus-throughput',
      name: 'EventBus Throughput',
      description: 'Emit 1K, 10K, 50K, 100K, and 250K events with subscribers and middleware',
      category: 'eventbus',
      config: scenario.config,
      metrics: lastResult?.metrics ?? { throughput: 0, latency: { p50: 0, p95: 0, p99: 0 }, memory: { heapUsedMB: 0, heapTotalMB: 0 }, dropped: 0, duration: 0 },
      success: true,
      timestamp: Date.now(),
      score: Math.round(avgScore * 10) / 10,
      subResults,
    }
  },
}

BR.register(scenario)
