// ── MonteCarlo — Monte Carlo simulation template ──
//
// Runs multiple backtests with resampled trade sequences
// to estimate the distribution of outcomes.
//
// @since 3.5.3

import type { BacktestConfig, BacktestTemplate } from '../types'

export class MonteCarlo implements BacktestTemplate {
  readonly id = 'monte-carlo'
  readonly name = 'Monte Carlo Simulation'
  readonly description = 'Multiple runs with resampled trade sequences for distribution analysis'

  private iterations: number

  constructor(iterations: number = 100) {
    this.iterations = iterations
  }

  createConfigs(base: BacktestConfig): BacktestConfig[] {
    const configs: BacktestConfig[] = []

    for (let i = 0; i < this.iterations; i++) {
      configs.push({
        ...base,
        id: `${base.id}-mc-${i}`,
        name: `${base.name} [MC #${i + 1}]`,
        // Monte Carlo seed could be stored in params
        strategyParams: {
          ...base.strategyParams,
          _mcSeed: i + 1,
        },
      })
    }

    return configs
  }
}
