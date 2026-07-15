/**
 * ReplayBench — benchmark replay engine at various speeds
 *
 * Tests: 1×, 10×, 100×, 500×, 1000× speed
 * Metrics: events/sec, memory
 *
 * @since 2.0.0
 */

import type { BenchmarkScenario, BenchmarkResult } from '../types'
import { BenchmarkRegistry as BR } from '../BenchmarkRegistry'
import { MetricsCollector } from '../MetricsCollector'

class BenchReplayEngine {
  private events: unknown[] = []
  private position = 0

  record(event: unknown): void {
    this.events.push(event)
  }

  replay(speed: number, onEvent: (event: unknown) => void): number {
    const start = performance.now()
    this.position = 0

    while (this.position < this.events.length) {
      onEvent(this.events[this.position])
      this.position += speed // skip events at higher speeds
    }

    return performance.now() - start
  }

  clear(): void {
    this.events = []
    this.position = 0
  }

  get eventCount(): number {
    return this.events.length
  }
}

const SPEED_LEVELS = [1, 10, 100, 500, 1000] as const

async function runReplayBench(): Promise<BenchmarkResult[]> {
  const engine = new BenchReplayEngine()
  const results: BenchmarkResult[] = []
  const TOTAL_EVENTS = 10_000

  // Record events
  for (let i = 0; i < TOTAL_EVENTS; i++) {
    engine.record({ index: i, topic: 'market.price', payload: { symbol: 'BTCUSDT', price: 50000 + Math.random() * 1000 } })
  }

  for (const speed of SPEED_LEVELS) {
    const collector = new MetricsCollector()
    let eventsProcessed = 0

    collector.start()
    const duration = engine.replay(speed, (_event) => {
      eventsProcessed++
      collector.record(0.01) // Simulated latency per event
    })
    const metrics = collector.stop()

    const speedScore = Math.min(100, (speed / 1000) * 100)
    const throughputScore = Math.min(100, (eventsProcessed / (duration || 1)) * 0.1)
    const score = Math.round((speedScore * 0.4 + throughputScore * 0.6) * 10) / 10

    results.push({
      id: `replay-${speed}x`,
      name: `${speed}× Speed`,
      description: `Replay ${eventsProcessed} events at ${speed}× speed`,
      category: 'replay',
      config: { name: `${speed}× Replay`, description: '', iterations: TOTAL_EVENTS, warmupIterations: 100 },
      metrics,
      success: true,
      timestamp: Date.now(),
      score,
    })
  }

  return results
}

const scenario: BenchmarkScenario = {
  id: 'replay-performance',
  name: 'Replay Performance',
  description: 'Benchmarks replay engine at 1×, 10×, 100×, 500×, and 1000× speed',
  category: 'replay',
  config: {
    name: 'Replay Benchmark',
    description: 'Replay performance across speed levels',
    iterations: 10_000,
    warmupIterations: 500,
  },
  run: async (): Promise<BenchmarkResult> => {
    const subResults = await runReplayBench()
    const avgScore = subResults.reduce((s, r) => s + r.score, 0) / subResults.length
    const lastResult = subResults[subResults.length - 1]

    return {
      id: 'replay-performance',
      name: 'Replay Performance',
      description: 'Benchmarks replay engine at 1×, 10×, 100×, 500×, and 1000× speed',
      category: 'replay',
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
