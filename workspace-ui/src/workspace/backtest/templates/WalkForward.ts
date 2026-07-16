// ── WalkForward — Walk-forward analysis template ──
//
// Splits data into windows: in-sample (IS) and out-of-sample (OOS).
// Optimizes on each IS window, tests on the following OOS window.
//
// @since 3.5.3

import type { BacktestConfig, BacktestTemplate } from '../types'

export class WalkForward implements BacktestTemplate {
  readonly id = 'walk-forward'
  readonly name = 'Walk-Forward Analysis'
  readonly description = 'Splits data into training/test windows for robustness testing'

  private windowSize: number
  private stepSize: number
  private oosRatio: number

  /**
   * @param windowSize Number of bars per window
   * @param stepSize Number of bars to advance between windows
   * @param oosRatio Fraction of window used for out-of-sample (default: 0.3)
   */
  constructor(windowSize: number = 1000, stepSize: number = 500, oosRatio: number = 0.3) {
    this.windowSize = windowSize
    this.stepSize = stepSize
    this.oosRatio = oosRatio
  }

  createConfigs(base: BacktestConfig): BacktestConfig[] {
    const configs: BacktestConfig[] = []
    const totalBars = this.estimateBars(base)

    let start = 0
    let windowIndex = 0

    while (start + this.windowSize <= totalBars) {
      const isEnd = start + Math.floor(this.windowSize * (1 - this.oosRatio))
      const oosEnd = start + this.windowSize

      // In-sample config (training)
      configs.push({
        ...base,
        id: `${base.id}-wf-${windowIndex}-is`,
        name: `${base.name} [WF ${windowIndex} IS]`,
        startDate: start,
        maxBars: isEnd - start,
      })

      // Out-of-sample config (testing)
      configs.push({
        ...base,
        id: `${base.id}-wf-${windowIndex}-oos`,
        name: `${base.name} [WF ${windowIndex} OOS]`,
        startDate: isEnd,
        maxBars: oosEnd - isEnd,
      })

      start += this.stepSize
      windowIndex++
    }

    return configs
  }

  private estimateBars(config: BacktestConfig): number {
    return config.maxBars ?? 10000 // fallback estimate
  }
}
