// ── Backtest Types — shared contracts for Backtest Runtime ──
//
// @since 3.5.3

import type { StrategyBar } from '../strategy/definition'
import type { MarketSnapshot, SlippageModel, CommissionModel, FillModel, ExecutionConfig } from '../execution/types'
import type { MetricsSnapshot } from '../metrics/serialization/MetricsSnapshot'

// ═══════════════════════════════════════
// Session
// ═══════════════════════════════════════

export type SessionStatus =
  | 'idle'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'

export interface BacktestSessionInfo {
  id: string
  name: string
  status: SessionStatus
  config: BacktestConfig
  progress: BacktestProgress
  startedAt: number | null
  completedAt: number | null
  error?: string
}

// ═══════════════════════════════════════
// Config
// ═══════════════════════════════════════

export interface BacktestConfig {
  id: string
  name: string
  symbol: string
  timeframe: string
  initialCash: number
  startDate?: number
  endDate?: number
  /** Strategy definition ID to instantiate */
  strategyId: string
  strategyParams?: Record<string, unknown>
  /** How bars map to bid/ask (spread as fraction, e.g. 0.001 = 0.1%) */
  spread: number
  /** Execution model overrides */
  execution?: Partial<ExecutionConfig>
  /** Max bars to process (0 = all) */
  maxBars?: number
}

// ═══════════════════════════════════════
// Progress
// ═══════════════════════════════════════

export interface BacktestProgress {
  barsProcessed: number
  totalBars: number
  percent: number       // 0–100
  elapsedMs: number
  etaMs: number
  barsPerSecond: number
}

// ═══════════════════════════════════════
// Feed
// ═══════════════════════════════════════

export interface BacktestFeed {
  readonly symbol: string
  readonly timeframe: string
  readonly totalBars: number
  readonly position: number

  hasNext(): boolean
  /** Advance cursor and return next market snapshot */
  next(spread: number): MarketSnapshot
  /** Peek at next bar without advancing */
  peek(): StrategyBar | null
  /** Reset to beginning */
  reset(): void
  /** Progress ratio 0–1 */
  get progress(): number
}

// ═══════════════════════════════════════
// Playback
// ═══════════════════════════════════════

export type SpeedPreset = 1 | 2 | 5 | 10 | 50 | 100 | 1000 | 'max'

export interface PlaybackState {
  speed: SpeedPreset
  isPlaying: boolean
  isStepMode: boolean
  stepForward: boolean
}

// ═══════════════════════════════════════
// Clock
// ═══════════════════════════════════════

export interface SessionClock {
  /** Current virtual timestamp */
  now: number
  /** Elapsed virtual time */
  elapsed: number
  /** Start of session */
  startTime: number
  /** Advance clock by one bar */
  tick(barTimestamp: number): void
}

// ═══════════════════════════════════════
// Report
// ═══════════════════════════════════════

export interface BacktestReport {
  sessionId: string
  name: string
  config: BacktestConfig
  metrics: MetricsSnapshot | null
  duration: {
    startedAt: number
    completedAt: number
    elapsedMs: number
    barsProcessed: number
    barsPerSecond: number
  }
  errors?: string[]
}

// ═══════════════════════════════════════
// Templates
// ═══════════════════════════════════════

export interface BacktestTemplate {
  readonly id: string
  readonly name: string
  readonly description: string
  /** Create configs for this template */
  createConfigs(base: BacktestConfig): BacktestConfig[]
}

// ═══════════════════════════════════════
// Strategy Runtime Adapter
// ═══════════════════════════════════════

export interface StrategyExecutor {
  /** Strategy definition ID */
  readonly id: string
  /** Initialize strategy instance */
  init(config: BacktestConfig): Promise<void> | void
  /** Process one bar */
  onBar(bar: StrategyBar): Promise<void> | void
  /** Cleanup */
  dispose(): void
}

// ── Re-exports used in public API ──
export type { StrategyBar, MarketSnapshot, SlippageModel, CommissionModel, FillModel, ExecutionConfig }
