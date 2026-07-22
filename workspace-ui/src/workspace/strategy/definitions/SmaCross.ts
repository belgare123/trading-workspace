// ── SmaCross — SMA Crossover Strategy ──
// Sprint 5.7 — Demo strategy for new pipeline

import type { StrategyDefinition, StrategyBar, StrategyContextBar } from '../definition'
import type { ExecutionContext } from '../context'
import type { StrategySignal } from '../types'

interface SmaCrossParams {
  fastPeriod: number
  slowPeriod: number
}

export class SmaCross implements StrategyDefinition {
  readonly id = 'sma-cross'
  readonly name = 'SMA Crossover'
  readonly version = '1.0.0'
  readonly description = 'Generates buy when fast SMA crosses above slow SMA, sell when fast crosses below'
  readonly defaultParameters = {
    fastPeriod: 10,
    slowPeriod: 30,
  }

  create(_ctx: ExecutionContext, params?: Record<string, unknown>): Record<string, unknown> {
    const p = { ...this.defaultParameters, ...params } as SmaCrossParams
    return {
      fastPeriod: p.fastPeriod,
      slowPeriod: p.slowPeriod,
      prevFast: null as number | null,
      prevSlow: null as number | null,
      prevFastAboveSlow: false,
      bars: [] as StrategyBar[],
    }
  }

  onBar(context: StrategyContextBar, ctx: ExecutionContext): StrategySignal | null {
    const state = ctx.state
    const fastPeriod = state.fastPeriod as number
    const slowPeriod = state.slowPeriod as number
    const bars = state.bars as StrategyBar[]

    bars.push(context.bar)
    if (bars.length > slowPeriod * 2) {
      bars.splice(0, bars.length - slowPeriod * 2)
    }
    if (bars.length < slowPeriod) return null

    const fastMA = this._sma(bars, fastPeriod)
    const slowMA = this._sma(bars, slowPeriod)
    if (fastMA === null || slowMA === null) return null

    const prevFastAboveSlow = state.prevFastAboveSlow as boolean
    const fastAboveSlow = fastMA > slowMA
    state.prevFast = fastMA
    state.prevSlow = slowMA
    state.prevFastAboveSlow = fastAboveSlow

    // Cross up: fast crosses above slow → buy signal
    if (fastAboveSlow && !prevFastAboveSlow) {
      return {
        direction: 'buy',
        symbol: '', // filled by StrategyRegistry
        price: context.bar.close,
        confidence: this._calcConfidence(fastMA, slowMA),
        timestamp: context.bar.timestamp,
      }
    }

    // Cross down: fast crosses below slow → close (sell) signal
    if (!fastAboveSlow && prevFastAboveSlow) {
      return {
        direction: 'close',
        symbol: '',
        price: context.bar.close,
        confidence: 1,
        timestamp: context.bar.timestamp,
      }
    }

    return null
  }

  private _sma(bars: StrategyBar[], period: number): number | null {
    if (bars.length < period) return null
    let sum = 0
    for (let i = bars.length - period; i < bars.length; i++) {
      sum += bars[i].close
    }
    return sum / period
  }

  private _calcConfidence(fastMA: number, slowMA: number): number {
    const diffPct = Math.abs(fastMA - slowMA) / slowMA
    return Math.min(1, diffPct * 10)
  }
}
