// ── TrialRunner — Run one trial using BacktestRuntime ──
//
// Interfaces with BacktestRuntime to execute a single trial.
// No trading logic — delegates to BacktestRuntime.
//
// @since 3.5.4

import type { TrialConfig, TrialResult } from '../types'
import type { BacktestRuntime } from '../../backtest/runtime/BacktestRuntime'
import type { BacktestFeed } from '../../backtest/types'

export class TrialRunner {
  private _backtest: BacktestRuntime
  private _feedFactory: (config: TrialConfig) => BacktestFeed

  constructor(
    backtest: BacktestRuntime,
    feedFactory: (config: TrialConfig) => BacktestFeed,
  ) {
    this._backtest = backtest
    this._feedFactory = feedFactory
  }

  /** Execute one trial synchronously (blocking until done) */
  async run(trial: TrialConfig): Promise<TrialResult> {
    const startedAt = Date.now()
    const result: TrialResult = {
      trialId: trial.id,
      parameters: trial.parameters,
      status: 'running',
      score: null,
      metrics: null,
      backtestReport: null,
      duration: 0,
      startedAt,
      completedAt: null,
    }

    try {
      const feed = this._feedFactory(trial)
      const session = this._backtest.createSession(trial.backtestConfig, feed)

      // Run via scheduler
      const report = await this._backtest.scheduler.run(session)

      result.status = 'completed'
      result.metrics = report?.metrics ?? null
      result.backtestReport = report ?? null
      result.duration = Date.now() - startedAt
      result.completedAt = Date.now()
      result.score = null // assigned later by OptimizationSession
    } catch (err) {
      result.status = 'failed'
      result.error = err instanceof Error ? err.message : String(err)
      result.duration = Date.now() - startedAt
      result.completedAt = Date.now()
    }

    return result
  }
}
