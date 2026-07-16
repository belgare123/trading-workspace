// ── TrialScheduler — Schedule and execute trials ──
//
// Manages trial queue with sequential and parallel execution.
//
// @since 3.5.4

import type { TrialConfig, TrialResult } from '../types'
import type { TrialRunner } from './TrialRunner'

export type TrialSchedulerEvent =
  | { type: 'trial-started'; trialId: string; config: TrialConfig }
  | { type: 'trial-completed'; trialId: string; result: TrialResult }
  | { type: 'trial-failed'; trialId: string; error: string }
  | { type: 'batch-completed'; count: number }
  | { type: 'all-completed'; total: number }

export type TrialEventHandler = (event: TrialSchedulerEvent) => void

export class TrialScheduler {
  private _runner: TrialRunner
  private _maxConcurrent: number
  private _onEvent?: TrialEventHandler

  constructor(runner: TrialRunner, maxConcurrent: number = 1, onEvent?: TrialEventHandler) {
    this._runner = runner
    this._maxConcurrent = maxConcurrent
    this._onEvent = onEvent
  }

  /** Execute a batch of trials */
  async runBatch(trials: TrialConfig[]): Promise<TrialResult[]> {
    const results: TrialResult[] = []

    // Start initial batch
    const running = new Map<string, Promise<TrialResult>>()
    const queue = [...trials]

    while (queue.length > 0 || running.size > 0) {
      // Fill available slots
      while (queue.length > 0 && running.size < this._maxConcurrent) {
        const trial = queue.shift()!
        const promise = this._runner.run(trial)
        running.set(trial.id, promise)
        this._onEvent?.({ type: 'trial-started', trialId: trial.id, config: trial })
      }

      if (running.size === 0) break

      // Wait for any to complete
      const [completedId, result] = await Promise.race(
        Array.from(running.entries()).map(async ([id, p]) => [id, await p] as const),
      )

      running.delete(completedId)
      results.push(result)

      if (result.status === 'completed') {
        this._onEvent?.({ type: 'trial-completed', trialId: completedId, result })
      } else {
        this._onEvent?.({ type: 'trial-failed', trialId: completedId, error: result.error ?? 'unknown' })
      }

      this._onEvent?.({ type: 'batch-completed', count: results.length })
    }

    this._onEvent?.({ type: 'all-completed', total: results.length })
    return results
  }

  /** Sequential execution (one at a time) */
  async runSequential(trials: TrialConfig[]): Promise<TrialResult[]> {
    const results: TrialResult[] = []
    for (const trial of trials) {
      this._onEvent?.({ type: 'trial-started', trialId: trial.id, config: trial })
      const result = await this._runner.run(trial)
      results.push(result)
      if (result.status === 'completed') {
        this._onEvent?.({ type: 'trial-completed', trialId: trial.id, result })
      } else {
        this._onEvent?.({ type: 'trial-failed', trialId: trial.id, error: result.error ?? 'unknown' })
      }
    }
    this._onEvent?.({ type: 'all-completed', total: results.length })
    return results
  }

  /** Cancel running trials */
  cancel(): void {
    // In-memory only — cancel future batches by clearing state
    // For real cancellation, need integration with BacktestRuntime
  }
}
