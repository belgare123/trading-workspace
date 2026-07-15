/**
 * BenchmarkRunner — orchestrates benchmark execution
 *
 * Runs scenarios sequentially, collects metrics, and generates reports.
 * Supports loading at different levels (e.g., 1K, 10K, 50K events).
 *
 * @since 2.0.0
 */

import type {
  BenchmarkScenario,
  BenchmarkResult,
  BenchmarkCategory,
  RuntimeScore,
  BenchmarkReport,
} from './types'
import { CATEGORY_WEIGHTS, calculateGrade, formatOps } from './types'
import { BenchmarkRegistry } from './BenchmarkRegistry'
import { MetricsCollector } from './MetricsCollector'

export type RunnerCallback = (
  scenarioId: string,
  status: 'warmup' | 'running' | 'completed' | 'error',
  result?: BenchmarkResult,
) => void

export class BenchmarkRunner {
  private results: BenchmarkResult[] = []
  private onUpdate: RunnerCallback | null = null
  private _isRunning = false

  /** Subscribe to progress updates */
  onProgress(cb: RunnerCallback): void {
    this.onUpdate = cb
  }

  get isRunning(): boolean {
    return this._isRunning
  }

  /** Run a single scenario by ID */
  async runSingle(scenarioId: string): Promise<BenchmarkResult> {
    const scenario = BenchmarkRegistry.get(scenarioId)
    if (!scenario) throw new Error(`Scenario not found: ${scenarioId}`)
    return this.executeScenario(scenario)
  }

  /** Run all registered scenarios */
  async runAll(): Promise<BenchmarkReport> {
    this.results = []
    this._isRunning = true

    const scenarios = BenchmarkRegistry.list()
    for (const scenario of scenarios) {
      try {
        const result = await this.executeScenario(scenario)
        this.results.push(result)
      } catch (err) {
        this.onUpdate?.(scenario.id, 'error')
        this.results.push({
          id: scenario.id,
          name: scenario.name,
          description: scenario.description,
          category: scenario.category,
          config: scenario.config,
          metrics: { throughput: 0, latency: { p50: 0, p95: 0, p99: 0 }, memory: { heapUsedMB: 0, heapTotalMB: 0 }, dropped: 0, duration: 0 },
          success: false,
          error: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
          score: 0,
        })
      }
    }

    this._isRunning = false
    return this.generateReport()
  }

  /** Run scenarios filtered by category */
  async runCategory(category: BenchmarkCategory): Promise<BenchmarkReport> {
    this.results = []
    this._isRunning = true

    const scenarios = BenchmarkRegistry.list(category)
    for (const scenario of scenarios) {
      try {
        const result = await this.executeScenario(scenario)
        this.results.push(result)
      } catch (err) {
        this.results.push({
          id: scenario.id,
          name: scenario.name,
          description: scenario.description,
          category: scenario.category,
          config: scenario.config,
          metrics: { throughput: 0, latency: { p50: 0, p95: 0, p99: 0 }, memory: { heapUsedMB: 0, heapTotalMB: 0 }, dropped: 0, duration: 0 },
          success: false,
          error: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
          score: 0,
        })
      }
    }

    this._isRunning = false
    return this.generateReport()
  }

  private async executeScenario(scenario: BenchmarkScenario): Promise<BenchmarkResult> {
    this.onUpdate?.(scenario.id, 'warmup')

    // Warmup phase
    if (scenario.config.warmupIterations > 0) {
      const warmupCollector = new MetricsCollector()
      warmupCollector.start()
      // Run a simplified version for warmup — just advance iterations
      for (let i = 0; i < scenario.config.warmupIterations; i++) {
        warmupCollector.record(0.1)
      }
      warmupCollector.stop()
    }

    this.onUpdate?.(scenario.id, 'running')

    const result = await scenario.run()

    this.onUpdate?.(scenario.id, 'completed', result)
    return result
  }

  /** Calculate overall Runtime Score from all completed results */
  calculateScore(): RuntimeScore {
    const categories: Record<string, { score: number; weight: number }> = {}
    let weightedSum = 0
    let weightTotal = 0

    for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
      const catResults = this.results.filter((r) => r.category === cat && r.success)
      if (catResults.length > 0) {
        const catScore = catResults.reduce((sum, r) => sum + r.score, 0) / catResults.length
        categories[cat] = { score: Math.round(catScore), weight }
        weightedSum += catScore * weight
        weightTotal += weight
      }
    }

    const overall = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 10) / 10 : 0

    return {
      overall,
      grade: calculateGrade(overall),
      categories,
      timestamp: Date.now(),
      runtimeVersion: '2.0.0',
    }
  }

  /** Generate a complete benchmark report */
  generateReport(): BenchmarkReport {
    const score = this.calculateScore()
    return {
      runtimeVersion: '2.0.0',
      timestamp: Date.now(),
      overallScore: score.overall,
      grade: score.grade,
      results: this.results,
      score,
    }
  }

  /** Get detailed results table rows */
  getResultsTable(): string[][] {
    return this.results.map((r) => [
      r.success ? '✅' : '❌',
      r.name,
      formatOps(r.metrics.throughput),
      r.metrics.latency.p50.toFixed(2) + 'ms',
      r.metrics.latency.p95.toFixed(2) + 'ms',
      r.metrics.latency.p99.toFixed(2) + 'ms',
      r.metrics.memory.heapUsedMB.toFixed(1) + 'MB',
      r.score.toFixed(1),
    ])
  }
}
