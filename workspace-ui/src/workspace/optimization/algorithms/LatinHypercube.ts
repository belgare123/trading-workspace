// ── LatinHypercube — Latin Hypercube Sampling ──
//
// Efficient space-filling sampling. Better coverage than random for
// the same number of samples when the parameter space is high-dimensional.
//
// @since 3.5.4

import type { OptimizationConfig, ParameterSpace, TrialConfig, TrialResult, OptimizationAlgorithm } from '../types'
import { ParameterGenerator } from '../parameters/ParameterGenerator'

export class LatinHypercube implements OptimizationAlgorithm {
  readonly id = 'latin-hypercube'
  readonly name = 'Latin Hypercube'
  readonly description = 'Stratified random sampling for efficient space coverage'

  private _sampled = false
  private _allConfigs: TrialConfig[] = []

  next(
    config: OptimizationConfig,
    space: ParameterSpace,
    completed: TrialResult[],
    running: TrialConfig[],
    count: number,
  ): TrialConfig[] {
    if (!this._sampled) {
      this._allConfigs = []
      const generator = ParameterGenerator.latinHypercube(space, config.maxTrials)
      for (const params of generator) {
        const trialId = `trial_${config.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        this._allConfigs.push({
          id: trialId,
          parameters: params,
          backtestConfig: {
            id: `${trialId}_cfg`,
            name: config.name,
            symbol: '',
            timeframe: '',
            initialCash: 100000,
            strategyId: '',
            spread: 0,
            strategyParams: params,
          } as any,
        })
      }
      this._sampled = true
    }

    const doneIds = new Set(completed.map(t => t.trialId))
    const runIds = new Set(running.map(t => t.id))
    const result: TrialConfig[] = []

    for (const tc of this._allConfigs) {
      if (result.length >= count) break
      if (!doneIds.has(tc.id) && !runIds.has(tc.id)) {
        result.push(tc)
      }
    }

    return result
  }

  estimatedSize(config: OptimizationConfig, _space: ParameterSpace): number {
    return config.maxTrials
  }
}
