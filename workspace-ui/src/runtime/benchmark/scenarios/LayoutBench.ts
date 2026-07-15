/**
 * LayoutBench — benchmark layout operations (drag, resize, fullscreen, collapse, pin)
 *
 * Tests: 100 panels with all operations
 * Metrics: operation latency, memory
 *
 * @since 2.0.0
 */

import type { BenchmarkScenario, BenchmarkResult } from '../types'
import { BenchmarkRegistry as BR } from '../BenchmarkRegistry'
import { MetricsCollector } from '../MetricsCollector'

interface PanelState {
  id: string
  x: number
  y: number
  w: number
  h: number
  collapsed: boolean
  pinned: boolean
  fullscreen: boolean
}

class BenchLayoutEngine {
  private panels = new Map<string, PanelState>()

  add(id: string): void {
    this.panels.set(id, { id, x: 0, y: 0, w: 400, h: 300, collapsed: false, pinned: false, fullscreen: false })
  }

  drag(id: string, dx: number, dy: number): number {
    const start = performance.now()
    const p = this.panels.get(id)
    if (p) { p.x += dx; p.y += dy }
    return performance.now() - start
  }

  resize(id: string, dw: number, dh: number): number {
    const start = performance.now()
    const p = this.panels.get(id)
    if (p) { p.w = Math.max(100, p.w + dw); p.h = Math.max(100, p.h + dh) }
    return performance.now() - start
  }

  toggleFullscreen(id: string): number {
    const start = performance.now()
    const p = this.panels.get(id)
    if (p) p.fullscreen = !p.fullscreen
    return performance.now() - start
  }

  collapse(id: string): number {
    const start = performance.now()
    const p = this.panels.get(id)
    if (p) p.collapsed = !p.collapsed
    return performance.now() - start
  }

  pin(id: string): number {
    const start = performance.now()
    const p = this.panels.get(id)
    if (p) p.pinned = !p.pinned
    return performance.now() - start
  }
}

async function runLayoutBench(): Promise<BenchmarkResult[]> {
  const engine = new BenchLayoutEngine()
  const results: BenchmarkResult[] = []
  const PANEL_COUNT = 100

  // Create panels
  const panelIds: string[] = []
  for (let i = 0; i < PANEL_COUNT; i++) {
    const id = `panel-${i}`
    engine.add(id)
    panelIds.push(id)
  }

  // Drag
  {
    const collector = new MetricsCollector()
    collector.start()
    for (const id of panelIds) {
      const t0 = performance.now()
      engine.drag(id, Math.random() * 100, Math.random() * 100)
      collector.record(performance.now() - t0)
    }
    const metrics = collector.stop()
    const score = Math.min(100, (PANEL_COUNT / (metrics.latency.p50 || 0.01)) * 0.1)
    results.push({
      id: 'layout-drag',
      name: 'Drag 100 Panels',
      description: `Drag ${PANEL_COUNT} panels with random offsets`,
      category: 'layout',
      config: { name: 'Drag', description: '', iterations: PANEL_COUNT, warmupIterations: 10 },
      metrics,
      success: true,
      timestamp: Date.now(),
      score: Math.round(score * 10) / 10,
    })
  }

  // Resize
  {
    const collector = new MetricsCollector()
    collector.start()
    for (const id of panelIds) {
      const t0 = performance.now()
      engine.resize(id, Math.random() * 200 - 100, Math.random() * 200 - 100)
      collector.record(performance.now() - t0)
    }
    const metrics = collector.stop()
    const score = Math.min(100, (PANEL_COUNT / (metrics.latency.p50 || 0.01)) * 0.1)
    results.push({
      id: 'layout-resize',
      name: 'Resize 100 Panels',
      description: `Resize ${PANEL_COUNT} panels with random deltas`,
      category: 'layout',
      config: { name: 'Resize', description: '', iterations: PANEL_COUNT, warmupIterations: 10 },
      metrics,
      success: true,
      timestamp: Date.now(),
      score: Math.round(score * 10) / 10,
    })
  }

  // Toggle actions
  for (const [opName, fn] of [['Fullscreen', (id: string) => engine.toggleFullscreen(id)] as const, ['Collapse', (id: string) => engine.collapse(id)] as const, ['Pin', (id: string) => engine.pin(id)] as const]) {
    const collector = new MetricsCollector()
    collector.start()
    for (const id of panelIds) {
      const t0 = performance.now()
      fn(id)
      collector.record(performance.now() - t0)
    }
    const metrics = collector.stop()
    const score = Math.min(100, (PANEL_COUNT / (metrics.latency.p50 || 0.01)) * 0.1)
    results.push({
      id: `layout-${opName.toLowerCase()}`,
      name: `${opName} 100 Panels`,
      description: `Toggle ${opName.toLowerCase()} on ${PANEL_COUNT} panels`,
      category: 'layout',
      config: { name: opName, description: '', iterations: PANEL_COUNT, warmupIterations: 10 },
      metrics,
      success: true,
      timestamp: Date.now(),
      score: Math.round(score * 10) / 10,
    })
  }

  return results
}

const scenario: BenchmarkScenario = {
  id: 'layout-operations',
  name: 'Layout Operations',
  description: 'Benchmarks drag, resize, fullscreen, collapse, and pin on 100 panels',
  category: 'layout',
  config: {
    name: 'Layout Benchmark',
    description: 'Layout operations on 100 panels',
    iterations: 500,
    warmupIterations: 10,
  },
  run: async (): Promise<BenchmarkResult> => {
    const subResults = await runLayoutBench()
    const avgScore = subResults.reduce((s, r) => s + r.score, 0) / subResults.length
    const combinedMetrics = {
      throughput: subResults.reduce((s, r) => s + r.metrics.throughput, 0) / subResults.length,
      latency: {
        p50: subResults.reduce((s, r) => s + r.metrics.latency.p50, 0) / subResults.length,
        p95: subResults.reduce((s, r) => s + r.metrics.latency.p95, 0) / subResults.length,
        p99: subResults.reduce((s, r) => s + r.metrics.latency.p99, 0) / subResults.length,
      },
      memory: subResults[0]?.metrics.memory ?? { heapUsedMB: 0, heapTotalMB: 0 },
      dropped: subResults.reduce((s, r) => s + r.metrics.dropped, 0),
      duration: subResults.reduce((s, r) => s + r.metrics.duration, 0),
    }

    return {
      id: 'layout-operations',
      name: 'Layout Operations',
      description: 'Benchmarks drag, resize, fullscreen, collapse, and pin on 100 panels',
      category: 'layout',
      config: scenario.config,
      metrics: combinedMetrics,
      success: true,
      timestamp: Date.now(),
      score: Math.round(avgScore * 10) / 10,
      subResults,
    }
  },
}

BR.register(scenario)
