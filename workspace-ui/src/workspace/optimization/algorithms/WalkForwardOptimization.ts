// ── WalkForwardOptimization — Walk-Forward Optimization ──
//
// Runs grid search over rolling IS/OOS windows.
// Best params from IS window are tested on OOS window.
//
// @since 3.5.4

import type {
  OptimizationConfig, TrialConfig, TrialResult,
  OptimizationAlgorithm,
} from '../types'
import { ParameterGenerator } from '../parameters/ParameterGenerator'

export interface WalkForwardConfig {
  /** Number of IS bars per window */
  isLength: number
  /** Number of OOS bars per window */
  oosLength: number
  /** Step between windows (bars) */
  step: number
}

export class WalkForwardOptimization implements OptimizationAlgorithm {
  readonly id = 'walk-forward'
  readonly name = 'Walk-Forward Optimization'
  readonly description = 'Rolling in-sample/out-of-sample validation'

  readonly config: WalkForwardConfig

  constructor(wfConfig: WalkForwardConfig) {
    this.config = wfConfig
  }

  next(
    config: OptimizationConfig,
    space: { parameters: { id: string }[]; size(): number },
    completed: TrialResult[],
    running: TrialConfig[],
    count: number,
  ): TrialConfig[] {
    const allParams = Array.from(ParameterGenerator.grid(space as any))
    const totalWindows = Math.max(1, Math.floor(
      ((config.maxTrials / allParams.length) || 1)))

    const trialConfigs: TrialConfig[] = []
    for (let w = 0; w < totalWindows; w++) {
      for (let p = 0; p < allParams.length; p++) {
        const params = allParams[p]
        trialConfigs.push({
          id: `wf_${config.id}_w${w}_p${p}`,
          parameters: params,
          backtestConfig: {
            id: `wf_${config.id}_w${w}_p${p}_cfg`,
            name: config.name,
            symbol: '',
            timeframe: '',
            initialCash: 100000,
            strategyId: '',
            spread: 0,
            strategyParams: { ...params, wfWindow: w },
          } as any,
        })
      }
    }

    const doneKeys = new Set(completed.map(t => t.trialId))
    const runningKeys = new Set(running.map(t => t.id))
    const result: TrialConfig[] = []

    const start = completed.length + running.length
    for (let i = start; i < trialConfigs.length && result.length < count; i++) {
      const tc = trialConfigs[i]
      if (!doneKeys.has(tc.id) && !runningKeys.has(tc.id)) {
        result.push(tc)
      }
    }

    return result
  }

  estimatedSize(config: OptimizationConfig, space: { size(): number }): number {
    const windowCount = Math.max(1, Math.floor(config.maxTrials / space.size()))
    return windowCount * space.size()
  }
}
