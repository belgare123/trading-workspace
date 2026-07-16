// ── RandomSearch — Random sampling of parameter space ──
//
// @since 3.5.4

import type { OptimizationConfig, ParameterSpace, TrialConfig, TrialResult, OptimizationAlgorithm } from '../types'
import { ParameterGenerator } from '../parameters/ParameterGenerator'

export class RandomSearch implements OptimizationAlgorithm {
  readonly id = 'random-search'
  readonly name = 'Random Search'
  readonly description = 'Randomly samples parameter combinations'

  next(
    config: OptimizationConfig,
    space: ParameterSpace,
    completed: TrialResult[],
    running: TrialConfig[],
    count: number,
  ): TrialConfig[] {
    const doneParamKeys = new Set(
      [...completed, ...running].map(t => JSON.stringify(t.parameters)),
    )

    const result: TrialConfig[] = []
    const sampler = ParameterGenerator.random(space, config.maxTrials)

    for (const params of sampler) {
      if (result.length >= count) break
      const key = JSON.stringify(params)
      if (doneParamKeys.has(key)) continue
      doneParamKeys.add(key)

      const trialId = `trial_${config.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      result.push({
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

    return result
  }

  estimatedSize(config: OptimizationConfig, _space: ParameterSpace): number {
    return config.maxTrials
  }
}
