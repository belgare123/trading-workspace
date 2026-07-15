/**
 * WidgetBench — benchmark widget registry performance
 *
 * Tests: 10, 50, 100, 250, 500 widgets
 * Metrics: registry speed, memory
 *
 * @since 2.0.0
 */

import type { BenchmarkScenario, BenchmarkResult } from '../types'
import { BenchmarkRegistry as BR } from '../BenchmarkRegistry'
import { MetricsCollector } from '../MetricsCollector'

interface BenchWidget {
  id: string
  name: string
  version: string
  category: string
}

class BenchWidgetRegistry {
  private widgets = new Map<string, BenchWidget>()

  register(w: BenchWidget): void {
    this.widgets.set(w.id, w)
  }

  unregister(id: string): void {
    this.widgets.delete(id)
  }

  count(): number {
    return this.widgets.size
  }

  clear(): void {
    this.widgets.clear()
  }
}

async function runWidgetBench(): Promise<BenchmarkResult[]> {
  const registry = new BenchWidgetRegistry()
  const results: BenchmarkResult[] = []
  const LEVELS = [10, 50, 100, 250, 500]

  for (const count of LEVELS) {
    const collector = new MetricsCollector()
    registry.clear()

    collector.start()
    for (let i = 0; i < count; i++) {
      const t0 = performance.now()
      registry.register({
        id: `bench-widget-${i}`,
        name: `Bench Widget ${i}`,
        version: '1.0.0',
        category: 'bench',
      })
      collector.record(performance.now() - t0)
    }
    const metrics = collector.stop()

    const score = Math.min(100, (count / (metrics.latency.p50 || 0.01)) * 10)

    results.push({
      id: `widget-register-${count}`,
      name: `${count} Widgets`,
      description: `Register ${count} widgets in registry`,
      category: 'widget',
      config: { name: `${count} Widgets`, description: '', iterations: count, warmupIterations: 10 },
      metrics,
      success: true,
      timestamp: Date.now(),
      score: Math.round(score * 10) / 10,
    })
  }

  return results
}

const scenario: BenchmarkScenario = {
  id: 'widget-registry',
  name: 'Widget Registry',
  description: 'Benchmarks widget registration at 10, 50, 100, 250, and 500 widgets',
  category: 'widget',
  config: {
    name: 'Widget Benchmark',
    description: 'Registry throughput across widget counts',
    iterations: 500,
    warmupIterations: 10,
  },
  run: async (): Promise<BenchmarkResult> => {
    const subResults = await runWidgetBench()
    const avgScore = subResults.reduce((s, r) => s + r.score, 0) / subResults.length
    const lastResult = subResults[subResults.length - 1]

    return {
      id: 'widget-registry',
      name: 'Widget Registry',
      description: 'Benchmarks widget registration at 10, 50, 100, 250, and 500 widgets',
      category: 'widget',
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
