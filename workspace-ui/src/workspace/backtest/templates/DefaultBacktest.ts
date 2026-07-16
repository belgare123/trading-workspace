// ── DefaultBacktest — Standard single-pass backtest ──
//
// Simple default template: feed → strategy → execution → metrics → report.
//
// @since 3.5.3

import type { BacktestConfig, BacktestTemplate } from '../types'

export class DefaultBacktest implements BacktestTemplate {
  readonly id = 'default'
  readonly name = 'Default Backtest'
  readonly description = 'Standard single-pass backtest: one config, sequential execution'

  createConfigs(base: BacktestConfig): BacktestConfig[] {
    return [{ ...base }]
  }
}
