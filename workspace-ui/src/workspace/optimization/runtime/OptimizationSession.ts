// ── OptimizationSession — One optimization campaign ──
//
// First-class entity for a complete optimization run.
// Orchestrates: Algorithm → Generator → Scheduler → Scorer → Rank.
//
// @since 3.5.4

import type {
  OptimizationConfig, OptimizationSessionInfo, OptimizationStatus,
  OptimizationProgress, TrialConfig, TrialResult,
  ParameterSpace, ObjectiveDefinition, OptimizationAlgorithm,
} from '../types'
import { TrialRunner } from './TrialRunner'
import { TrialScheduler } from './TrialScheduler'
import { RankingEngine } from '../ranking/RankingEngine'

export type OptimizationSessionEvent =
  | { type: 'progress'; progress: OptimizationProgress }
  | { type: 'completed'; session: OptimizationSessionInfo; trials: TrialResult[] }
  | { type: 'failed'; error: string }

export type OptimizationSessionHandler = (event: OptimizationSessionEvent) => void

export class OptimizationSession {
  readonly id: string
  readonly config: OptimizationConfig
  readonly space: ParameterSpace
  readonly objective: ObjectiveDefinition
  readonly algorithm: OptimizationAlgorithm

  private _status: OptimizationStatus = 'idle'
  private _startedAt: number | null = null
  private _completedAt: number | null = null
  private _trials: TrialResult[] = []
  private _trialConfigs: TrialConfig[] = []
  private _onEvent?: OptimizationSessionHandler
  private _ranking: RankingEngine = new RankingEngine()

  constructor(
    config: OptimizationConfig,
    space: ParameterSpace,
    objective: ObjectiveDefinition,
    algorithm: OptimizationAlgorithm,
    onEvent?: OptimizationSessionHandler,
  ) {
    this.id = config.id
    this.config = config
    this.space = space
    this.objective = objective
    this.algorithm = algorithm
    this._onEvent = onEvent
  }

  /** Get session info */
  get info(): OptimizationSessionInfo {
    return {
      id: this.id,
      name: this.config.name,
      status: this._status,
      config: this.config,
      progress: this.progress,
      startedAt: this._startedAt,
      completedAt: this._completedAt,
    }
  }

  /** Get current progress */
  get progress(): OptimizationProgress {
    const completed = this._trials.filter(t => t.status === 'completed' || t.status === 'failed').length
    const running = this._trials.filter(t => t.status === 'running').length
    const failed = this._trials.filter(t => t.status === 'failed').length

    return {
      trialsTotal: this.config.maxTrials,
      trialsCompleted: completed,
      trialsRunning: running,
      trialsFailed: failed,
      percent: this.config.maxTrials > 0 ? (completed / this.config.maxTrials) * 100 : 0,
      elapsedMs: this._startedAt ? Date.now() - this._startedAt : 0,
      etaMs: 0,
      bestScore: this._bestScore,
    }
  }

  /** Run the full optimization */
  async run(): Promise<OptimizationSessionInfo> {
    this._status = 'running'
    this._startedAt = Date.now()
    this._trials = []
    this._trialConfigs = []

    // BacktestRuntime injected externally during session setup
    const runner = new TrialRunner(null as unknown as any, null as unknown as any) // BacktestRuntime injected externally
    const scheduler = new TrialScheduler(
      runner,
      this.config.parallelTrials ?? 1,
      (event) => {
        if (event.type === 'trial-completed') {
          // Score
          const trial = this._trials.find(t => t.trialId === event.result.trialId)
          if (trial && trial.metrics) {
            trial.score = this.objective.calculate(trial.metrics)
          }
          this._emitProgress()
        }
      },
    )

    try {
      let completed = 0
      while (completed < this.config.maxTrials) {
        const batchSize = Math.min(
          this.config.parallelTrials ?? 1,
          this.config.maxTrials - completed,
        )

        // Generate next batch
        const batch = this.algorithm.next(
          this.config,
          this.space,
          this._trials,
          this._trialConfigs,
          batchSize,
        )

        if (batch.length === 0) break

        this._trialConfigs.push(...batch)

        // Execute
        const results = await scheduler.runSequential(batch)

        // Score and store
        for (const result of results) {
          if (result.metrics) {
            result.score = this.objective.calculate(result.metrics)
          }
          this._trials.push(result)

          if (result.status === 'completed') {
            completed++
          }
        }

        this._emitProgress()

        // Check stop condition
        if (this._shouldStop()) break
      }

      this._status = 'completed'
    } catch (err) {
      this._status = 'failed'
      this._onEvent?.({
        type: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
    }

    this._completedAt = Date.now()
    this._onEvent?.({ type: 'completed', session: this.info, trials: this._trials })
    return this.info
  }

  /** Get scored trials ranked by objective */
  get rankedTrials() {
    return this._ranking.rank(this._trials, this.objective)
  }

  /** Get best trial */
  get best(): TrialResult | null {
    const ranked = this.rankedTrials
    if (ranked.length === 0) return null
    const best = ranked[0]
    return this._trials.find(t => t.trialId === best.trialId) ?? null
  }

  private get _bestScore(): number | null {
    const scored = this._trials
      .filter(t => t.status === 'completed' && t.score !== null)
      .map(t => t.score!)
    if (scored.length === 0) return null
    return this.objective.higherIsBetter
      ? Math.max(...scored)
      : Math.min(...scored)
  }

  private _shouldStop(): boolean {
    if (this._trials.length >= this.config.maxTrials) return true

    if (this.config.maxTime && this._startedAt) {
      if (Date.now() - this._startedAt > this.config.maxTime * 1000) return true
    }

    return false
  }

  private _emitProgress(): void {
    this._onEvent?.({ type: 'progress', progress: this.progress })
  }

  /** Resume from saved state */
  resume(snapshot: { trials: TrialResult[] }): void {
    this._trials = snapshot.trials
    this._status = 'running'
  }
}
