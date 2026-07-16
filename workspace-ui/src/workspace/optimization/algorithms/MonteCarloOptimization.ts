// ── MonteCarloOptimization — Monte Carlo Optimization ──
//
// Repeated random sampling with different random seeds.
// Useful for strategies with stochastic elements.
//
// @since 3.5.4

import type {
  OptimizationConfig, ParameterSpace, TrialConfig, TrialResult,
  OptimizationAlgorithm,
} from '../types'
import { ParameterGenerator } from '../parameters/ParameterGenerator'

export class MonteCarloOptimization implements OptimizationAlgorithm {
  readonly id = 'monte-carlo'
  readonly name = 'Monte Carlo Optimization'
  readonly description = 'Repeated random sampling with varying random seeds'

  private _seedRng: () => number

  constructor(seedRng?: () => number) {
    this._seedRng = seedRng ?? (() => Math.floor(Math.random() * 2147483647))
  }

  next(
    config: OptimizationConfig,
    space: ParameterSpace,
    completed: TrialResult[],
    running: TrialConfig[],
    count: number,
  ): TrialConfig[] {
    const doneParamSeedKeys = new Set(
      [...completed, ...running].map(t => `${JSON.stringify(t.parameters)}_${(t as TrialConfig).seed ?? 0}`),
    )

    const result: TrialConfig[] = []
    const sampler = ParameterGenerator.random(space, config.maxTrials * 2)

    for (const params of sampler) {
      if (result.length >= count) break
      const seed = this._seedRng()
      const key = `${JSON.stringify(params)}_${seed}`
      if (doneParamSeedKeys.has(key)) continue
      doneParamSeedKeys.add(key)

      const trialId = `mc_${config.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      result.push({
        id: trialId,
        parameters: params,
        seed,
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

    return result
  }

  estimatedSize(config: OptimizationConfig, _space: ParameterSpace): number {
    return config.maxTrials
  }
}
