/**
 * Benchmark — types and interfaces for the Runtime Benchmark Suite
 *
 * @since 2.0.0
 */

/** Configuration for a single benchmark scenario */
export interface BenchmarkConfig {
  name: string
  description: string
  iterations: number
  warmupIterations: number
  /** Target ops/sec for the scenario (if applicable) */
  target?: number
}

/** Collected metrics for one run */
export interface BenchmarkMetrics {
  /** Operations per second */
  throughput: number
  /** Latency distribution in milliseconds */
  latency: { p50: number; p95: number; p99: number }
  /** Memory metrics at end of run (MB) */
  memory: { heapUsedMB: number; heapTotalMB: number }
  /** Number of dropped/errored operations */
  dropped: number
  /** Wall-clock duration in milliseconds */
  duration: number
}

/** Result of a single benchmark scenario */
export interface BenchmarkResult {
  id: string
  name: string
  description: string
  category: BenchmarkCategory
  config: BenchmarkConfig
  metrics: BenchmarkMetrics
  success: boolean
  error?: string
  timestamp: number
  /** Nested sub-results (e.g., multiple load levels) */
  subResults?: BenchmarkResult[]
  /** Score 0-100 for this scenario */
  score: number
}

export type BenchmarkCategory =
  | 'eventbus'
  | 'plugin'
  | 'widget'
  | 'search'
  | 'layout'
  | 'replay'
  | 'command'
  | 'startup'

/** Weight for overall score calculation */
export const CATEGORY_WEIGHTS: Record<BenchmarkCategory, number> = {
  eventbus: 0.25,
  plugin: 0.10,
  widget: 0.15,
  search: 0.10,
  layout: 0.05,
  replay: 0.10,
  command: 0.05,
  startup: 0.20,
}

/** Runtime Score — unified performance score */
export interface RuntimeScore {
  overall: number
  grade: string
  categories: Record<string, { score: number; weight: number }>
  timestamp: number
  runtimeVersion: string
}

/** Full benchmark report */
export interface BenchmarkReport {
  runtimeVersion: string
  timestamp: number
  overallScore: number
  grade: string
  results: BenchmarkResult[]
  score: RuntimeScore
}

/** Scenario definition */
export interface BenchmarkScenario {
  id: string
  name: string
  description: string
  category: BenchmarkCategory
  config: BenchmarkConfig
  run: () => Promise<BenchmarkResult>
}

/** Running state of a scenario */
export type ScenarioStatus = 'idle' | 'warmup' | 'running' | 'completed' | 'error'

export function calculateGrade(score: number): string {
  if (score >= 98) return 'A+'
  if (score >= 95) return 'A'
  if (score >= 90) return 'A-'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return mb.toFixed(1) + ' MB'
}

export function formatOps(ops: number): string {
  if (ops >= 1_000_000) return (ops / 1_000_000).toFixed(1) + 'M'
  if (ops >= 1_000) return (ops / 1_000).toFixed(1) + 'K'
  return ops.toFixed(0)
}
