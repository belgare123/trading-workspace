// ── Optimization Types — shared contracts for Optimization Platform ──
//
// No dependency on trading logic — only BacktestRuntime contracts.
//
// @since 3.5.4

import type { BacktestConfig, BacktestReport, BacktestFeed } from '../backtest/types'
import type { MetricsSnapshot } from '../metrics/serialization/MetricsSnapshot'

// ═══════════════════════════════════════
// Parameter
// ═══════════════════════════════════════

export type ParamType = 'int' | 'float' | 'choice' | 'boolean'

export interface ParameterDefinition {
  readonly id: string
  readonly name: string
  readonly type: ParamType
  readonly description?: string
  readonly default?: unknown
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly choices?: unknown[]
}

export interface Constraint {
  readonly id: string
  readonly description: string
  evaluate(params: Record<string, unknown>): boolean
}

export interface ParameterSpace {
  readonly parameters: ParameterDefinition[]
  readonly constraints: Constraint[]
  /** Estimated total combinations */
  size(): number
}

// ═══════════════════════════════════════
// Trial
// ═══════════════════════════════════════

export type TrialStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface TrialConfig {
  id: string
  parameters: Record<string, unknown>
  seed?: number
  backtestConfig: BacktestConfig
}

export interface TrialResult {
  trialId: string
  parameters: Record<string, unknown>
  status: TrialStatus
  score: number | null
  metrics: MetricsSnapshot | null
  backtestReport: BacktestReport | null
  duration: number
  error?: string
  artifacts?: Record<string, unknown>
  startedAt: number
  completedAt: number | null
}

// ═══════════════════════════════════════
// Objective
// ═══════════════════════════════════════

export interface ObjectiveDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly higherIsBetter: boolean
  calculate(metrics: MetricsSnapshot): number | null
}

// ═══════════════════════════════════════
// Optimization
// ═══════════════════════════════════════

export type OptimizationStatus = 'idle' | 'initializing' | 'running' | 'paused' | 'completed' | 'failed'

export interface OptimizationConfig {
  id: string
  name: string
  description?: string
  algorithmId: string
  parameterSpace: ParameterSpace
  objectiveId: string
  objectiveIds?: string[]
  objectiveWeights?: Record<string, number>
  maxTrials: number
  maxTime?: number
  stopOnConvergence?: boolean
  convergenceWindow?: number
  parallelTrials?: number
}

export interface OptimizationSessionInfo {
  id: string
  name: string
  status: OptimizationStatus
  config: OptimizationConfig
  progress: OptimizationProgress
  startedAt: number | null
  completedAt: number | null
}

export interface OptimizationProgress {
  trialsTotal: number
  trialsCompleted: number
  trialsRunning: number
  trialsFailed: number
  percent: number
  elapsedMs: number
  etaMs: number
  bestScore: number | null
}

// ═══════════════════════════════════════
// Algorithm
// ═══════════════════════════════════════

export interface OptimizationAlgorithm {
  readonly id: string
  readonly name: string
  readonly description: string

  /** Generate next batch of trial configs */
  next(
    config: OptimizationConfig,
    space: ParameterSpace,
    completed: TrialResult[],
    running: TrialConfig[],
    count: number,
  ): TrialConfig[]

  /** Estimated total trials */
  estimatedSize(config: OptimizationConfig, space: ParameterSpace): number
}

// ═══════════════════════════════════════
// Ranking
// ═══════════════════════════════════════

export interface RankEntry {
  rank: number
  trialId: string
  parameters: Record<string, unknown>
  score: number | null
  higherIsBetter: boolean
}

export interface ParetoFrontEntry {
  trialId: string
  parameters: Record<string, unknown>
  scores: Record<string, number>
  isDominated: boolean
}

// ═══════════════════════════════════════
// Re-exports
// ═══════════════════════════════════════

export type { BacktestConfig, BacktestReport, BacktestFeed }
