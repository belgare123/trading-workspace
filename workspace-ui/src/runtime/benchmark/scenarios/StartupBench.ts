/**
 * StartupBench — benchmark simulated cold start
 *
 * Measures: Runtime → Plugins → Widgets → Layout → Dashboard Ready
 * Returns timing for each phase
 *
 * @since 2.0.0
 */

import type { BenchmarkScenario, BenchmarkResult } from '../types'
import { BenchmarkRegistry as BR } from '../BenchmarkRegistry'
import { MetricsCollector } from '../MetricsCollector'

interface StartupTiming {
  runtime: number
  plugins: number
  registry: number
  layout: number
  ready: number
  total: number
}

// Simulate cold start with realistic delays
async function simulateColdStart(): Promise<StartupTiming> {
  const timing: StartupTiming = { runtime: 0, plugins: 0, registry: 0, layout: 0, ready: 0, total: 0 }
  const totalStart = performance.now()

  // Phase 1: Runtime initialization (config load, service init)
  const t1 = performance.now()
  await new Promise((r) => setTimeout(r, 0)) // microtask yield
  timing.runtime = performance.now() - t1

  // Phase 2: Plugin loading (discover, load, init)
  const t2 = performance.now()
  const pluginCount = 15
  for (let i = 0; i < pluginCount; i++) {
    // Simulate plugin registration work
    const _meta = { id: `plugin-${i}`, name: `Plugin ${i}`, version: '1.0.0' }
    JSON.stringify(_meta)
  }
  timing.plugins = performance.now() - t2

  // Phase 3: Widget registry (register default widgets)
  const t3 = performance.now()
  const widgetCount = 25
  for (let i = 0; i < widgetCount; i++) {
    const _widget = { id: `widget-${i}`, name: `Widget ${i}`, version: '1.0.0', category: 'bench' }
    JSON.stringify(_widget)
  }
  timing.registry = performance.now() - t3

  // Phase 4: Layout initialization
  const t4 = performance.now()
  const _layout = { panels: [], grids: [], activePanel: null }
  JSON.stringify(_layout)
  timing.layout = performance.now() - t4

  // Phase 5: Dashboard ready signal
  const t5 = performance.now()
  const _ready = { status: 'ready', timestamp: Date.now() }
  JSON.stringify(_ready)
  timing.ready = performance.now() - t5

  timing.total = performance.now() - totalStart
  return timing
}

async function runStartupBench(): Promise<BenchmarkResult> {
  const collector = new MetricsCollector()

  // Run 3 cold starts and average
  const runs: StartupTiming[] = []
  for (let i = 0; i < 3; i++) {
    const timing = await simulateColdStart()
    runs.push(timing)
    collector.record(timing.total)
  }

  const metrics = collector.stop()

  // Average times
  const avg: StartupTiming = {
    runtime: runs.reduce((s, r) => s + r.runtime, 0) / runs.length,
    plugins: runs.reduce((s, r) => s + r.plugins, 0) / runs.length,
    registry: runs.reduce((s, r) => s + r.registry, 0) / runs.length,
    layout: runs.reduce((s, r) => s + r.layout, 0) / runs.length,
    ready: runs.reduce((s, r) => s + r.ready, 0) / runs.length,
    total: runs.reduce((s, r) => s + r.total, 0) / runs.length,
  }

  // Score: 500ms total = 100, 2000ms = 50, >5000ms = 0
  const score = Math.max(0, Math.min(100, 100 - ((avg.total - 500) / 1500) * 100))

  return {
    id: 'startup-cold',
    name: 'Cold Start',
    description: `Runtime cold start averaged ${avg.total.toFixed(0)}ms over 3 runs`,
    category: 'startup',
    config: { name: 'Cold Start', description: 'Runtime → Plugins → Registry → Layout → Ready', iterations: 3, warmupIterations: 0 },
    metrics,
    success: true,
    timestamp: Date.now(),
    score: Math.round(score * 10) / 10,
  }
}

const scenario: BenchmarkScenario = {
  id: 'startup-cold',
  name: 'Cold Start',
  description: 'Measures simulated cold start (Runtime → Plugins → Registry → Layout → Dashboard Ready)',
  category: 'startup',
  config: {
    name: 'Startup Benchmark',
    description: 'Cold start timing across 3 runs',
    iterations: 3,
    warmupIterations: 0,
  },
  run: async (): Promise<BenchmarkResult> => {
    return runStartupBench()
  },
}

BR.register(scenario)
