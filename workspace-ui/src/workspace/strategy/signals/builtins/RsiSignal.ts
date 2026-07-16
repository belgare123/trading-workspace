// ── RsiSignal — RSI overbought / oversold / divergence signals ──
//
// Modes:
//   'overbought'   — RSI rises above threshold (default: 70)
//   'oversold'     — RSI falls below threshold (default: 30)
//   'cross-above'  — RSI crosses above threshold (e.g. exits oversold)
//   'cross-below'  — RSI crosses below threshold (e.g. exits overbought)
//
// @since 3.4.3

import type { SignalDefinition } from '../definition/SignalDefinition'
import type { ExecutionContext } from '../../context'
import type { SignalResult } from '../types'
import { normalize } from '../utils/SignalHelpers'

export const RsiSignal: SignalDefinition = {
  id: 'rsi',
  name: 'RSI',
  description: 'RSI overbought / oversold / crossover signals',
  version: '1.0.0',
  parameters: [
    { id: 'mode', name: 'Mode', type: 'select', default: 'overbought', description: 'Signal mode', options: ['overbought', 'oversold', 'cross-above', 'cross-below'] },
    { id: 'period', name: 'Period', type: 'number', default: 14, description: 'RSI period', min: 2, max: 100 },
    { id: 'threshold', name: 'Threshold', type: 'number', default: 70, description: 'Threshold for overbought/oversold', min: 1, max: 99 },
    { id: 'symbol', name: 'Symbol', type: 'string', default: '', description: 'Trading symbol' },
    { id: 'timeframe', name: 'Timeframe', type: 'string', default: '1h', description: 'Bar timeframe' },
  ],

  async evaluate(ctx: ExecutionContext, params: Record<string, unknown>): Promise<SignalResult> {
    const mode = params.mode as string ?? 'overbought'
    const period = (params.period as number) ?? 14
    const threshold = (params.threshold as number) ?? 70
    const symbol = (params.symbol as string) || ''
    const timeframe = (params.timeframe as string) || '1h'

    const rsiCurrent = await ctx.indicators.rsi(period, symbol, timeframe)
    const rsiPrev = await ctx.indicators.history('rsi', period, 2, symbol, timeframe)

    if (rsiCurrent == null) {
      return { active: false }
    }

    const prev = rsiPrev.length > 1 ? rsiPrev[rsiPrev.length - 2] : null

    switch (mode) {
      case 'overbought': {
        const active = rsiCurrent > threshold
        return {
          active,
          strength: active ? normalize(rsiCurrent, threshold, Math.max(threshold + 20, 95)) : 0,
          confidence: active ? normalize(rsiCurrent, threshold, 100) : 0,
          metadata: { rsi: rsiCurrent, threshold, direction: 'overbought' },
        }
      }

      case 'oversold': {
        const active = rsiCurrent < (100 - threshold)
        return {
          active,
          strength: active ? normalize(rsiCurrent, Math.min(threshold - 20, 5), threshold) : 0,
          confidence: active ? normalize(rsiCurrent, 0, 100 - threshold) : 0,
          metadata: { rsi: rsiCurrent, threshold: 100 - threshold, direction: 'oversold' },
        }
      }

      case 'cross-above': {
        const crossAbove = prev != null && prev <= (100 - threshold) && rsiCurrent > (100 - threshold)
        return {
          active: crossAbove,
          strength: crossAbove ? normalize(rsiCurrent, 100 - threshold, threshold) : 0,
          confidence: crossAbove ? 0.8 : 0,
          metadata: { rsi: rsiCurrent, prev, threshold: 100 - threshold, direction: 'cross-above' },
        }
      }

      case 'cross-below': {
        const crossBelow = prev != null && prev >= threshold && rsiCurrent < threshold
        return {
          active: crossBelow,
          strength: crossBelow ? normalize(rsiCurrent, 0, threshold) : 0,
          confidence: crossBelow ? 0.8 : 0,
          metadata: { rsi: rsiCurrent, prev, threshold, direction: 'cross-below' },
        }
      }

      default:
        return { active: false }
    }
  },
}
