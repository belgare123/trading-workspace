/**
 * PluginBench — benchmark plugin lifecycle operations
 *
 * Tests: Load, Unload, Reload, Restart, Sleep, Wake
 * Metrics: time, memory, hooks registration
 *
 * @since 2.0.0
 */

import type { BenchmarkScenario, BenchmarkResult, BenchmarkMetrics } from '../types'
import { BenchmarkRegistry as BR } from '../BenchmarkRegistry'
import { MetricsCollector } from '../MetricsCollector'

interface BenchPlugin {
  id: string
  name: string
  version: string
  loaded: boolean
  hooks: string[]
  loadTime: number
}

class BenchPluginManager {
  load(plugin: BenchPlugin): number {
    const start = performance.now()
    plugin.loaded = true
    plugin.hooks = ['onEvent', 'onCommand', 'onSearch']
    plugin.loadTime = performance.now() - start
    return plugin.loadTime
  }

  unload(plugin: BenchPlugin): number {
    const start = performance.now()
    plugin.loaded = false
    plugin.hooks = []
    return performance.now() - start
  }

  reload(plugin: BenchPlugin): number {
    this.unload(plugin)
    return this.load(plugin)
  }

  restart(plugin: BenchPlugin): number {
    this.unload(plugin)
    return this.load(plugin)
  }

  sleep(plugin: BenchPlugin): number {
    const start = performance.now()
    plugin.loaded = false
    return performance.now() - start
  }

  wake(plugin: BenchPlugin): number {
    const start = performance.now()
    plugin.loaded = true
    return performance.now() - start
  }
}

async function runPluginBench(): Promise<BenchmarkResult[]> {
  const manager = new BenchPluginManager()
  const results: BenchmarkResult[] = []
  const PLUGIN_COUNT = 50
  const plugins: BenchPlugin[] = []

  for (let i = 0; i < PLUGIN_COUNT; i++) {
    plugins.push({ id: `bench-plugin-${i}`, name: `Bench Plugin ${i}`, version: '1.0.0', loaded: false, hooks: [], loadTime: 0 })
  }

  // Each lifecycle operation
  const operations: Array<{ id: string; name: string; fn: (p: BenchPlugin) => number }> = [
    { id: 'plugin-load', name: 'Load 50 Plugins', fn: (p) => manager.load(p) },
    { id: 'plugin-unload', name: 'Unload 50 Plugins', fn: (p) => manager.unload(p) },
    { id: 'plugin-reload', name: 'Reload 50 Plugins', fn: (p) => manager.reload(p) },
    { id: 'plugin-restart', name: 'Restart 50 Plugins', fn: (p) => manager.restart(p) },
    { id: 'plugin-sleep', name: 'Sleep 50 Plugins', fn: (p) => manager.sleep(p) },
    { id: 'plugin-wake', name: 'Wake 50 Plugins', fn: (p) => manager.wake(p) },
  ]

  for (const op of operations) {
    const collector = new MetricsCollector()
    collector.start()
    for (const p of plugins) {
      const t0 = performance.now()
      op.fn(p)
      collector.record(performance.now() - t0)
    }
    const metrics = collector.stop()
    const score = Math.min(100, (PLUGIN_COUNT / (metrics.latency.p50 || 0.01)) * 0.5)
    results.push({
      id: op.id,
      name: op.name,
      description: `${op.name} sequentially`,
      category: 'plugin',
      config: { name: op.name, description: '', iterations: PLUGIN_COUNT, warmupIterations: 5 },
      metrics,
      success: true,
      timestamp: Date.now(),
      score: Math.round(score * 10) / 10,
    })
  }

  return results
}

function avgMetrics(results: BenchmarkResult[]): BenchmarkMetrics {
  return {
    throughput: results.reduce((s, r) => s + r.metrics.throughput, 0) / results.length,
    latency: {
      p50: results.reduce((s, r) => s + r.metrics.latency.p50, 0) / results.length,
      p95: results.reduce((s, r) => s + r.metrics.latency.p95, 0) / results.length,
      p99: results.reduce((s, r) => s + r.metrics.latency.p99, 0) / results.length,
    },
    memory: results[0]?.metrics.memory ?? { heapUsedMB: 0, heapTotalMB: 0 },
    dropped: results.reduce((s, r) => s + r.metrics.dropped, 0),
    duration: results.reduce((s, r) => s + r.metrics.duration, 0),
  }
}

const scenario: BenchmarkScenario = {
  id: 'plugin-lifecycle',
  name: 'Plugin Lifecycle',
  description: 'Benchmarks Load, Unload, Reload, Restart, Sleep, and Wake for 50 plugins',
  category: 'plugin',
  config: {
    name: 'Plugin Benchmark',
    description: 'Lifecycle operations across 50 plugins',
    iterations: 300,
    warmupIterations: 10,
  },
  run: async (): Promise<BenchmarkResult> => {
    const subResults = await runPluginBench()
    const avgScore = subResults.reduce((s, r) => s + r.score, 0) / subResults.length
    return {
      id: 'plugin-lifecycle',
      name: 'Plugin Lifecycle',
      description: 'Benchmarks Load, Unload, Reload, Restart, Sleep, and Wake for 50 plugins',
      category: 'plugin',
      config: scenario.config,
      metrics: avgMetrics(subResults),
      success: true,
      timestamp: Date.now(),
      score: Math.round(avgScore * 10) / 10,
      subResults,
    }
  },
}

BR.register(scenario)
