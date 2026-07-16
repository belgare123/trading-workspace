// ── GridSearch — Exhaustive grid search ──
//
// Iterates all combinations of parameter values.
//
// @since 3.5.4

import type { OptimizationConfig, TrialConfig, TrialResult, OptimizationAlgorithm } from '../types'
import { ParameterGenerator } from '../parameters/ParameterGenerator'

export class GridSearch implements OptimizationAlgorithm {
  readonly id = 'grid-search'
  readonly name = 'Grid Search'
  readonly description = 'Exhaustively evaluates all parameter combinations'

  next(
    config: OptimizationConfig,
    space: { size(): number },
    completed: TrialResult[],
    running: TrialConfig[],
    count: number,
  ): TrialConfig[] {
    const allParams = Array.from(ParameterGenerator.grid(space as any))
    const doneIds = new Set(completed.map(t => t.trialId))
    const runIds = new Set(running.map(t => t.id))
    const skipCount = completed.length + running.length

    const result: TrialConfig[] = []
    let found = 0

    for (let i = skipCount; i < allParams.length && found < count; i++) {
      const params = allParams[i]
      const trialId = `trial_${config.id}_${i}`

      if (!doneIds.has(trialId) && !runIds.has(trialId)) {
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
        found++
      }
    }

    return result
  }

  estimatedSize(_config: OptimizationConfig, space: { size(): number }): number {
    return space.size()
  }
}
