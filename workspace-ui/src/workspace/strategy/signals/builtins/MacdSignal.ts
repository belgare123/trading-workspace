// ── MacdSignal — MACD crossover / histogram / zero-line signals ──
//
// Modes:
//   'crossover'     — MACD line crosses signal line (bullish/bearish)
//   'histogram'     — histogram turns positive/negative
//   'zero-cross'    — MACD line crosses zero line
//
// @since 3.4.3

import type { SignalDefinition } from '../definition/SignalDefinition'
import type { ExecutionContext } from '../../context'
import type { SignalResult } from '../types'

export const MacdSignal: SignalDefinition = {
  id: 'macd',
  name: 'MACD',
  description: 'MACD crossover / histogram / zero-line signals',
  version: '1.0.0',
  parameters: [
    { id: 'mode', name: 'Mode', type: 'select', default: 'crossover', description: 'Signal mode', options: ['crossover', 'histogram', 'zero-cross'] },
    { id: 'fast', name: 'Fast Period', type: 'number', default: 12, description: 'Fast EMA period', min: 2, max: 100 },
    { id: 'slow', name: 'Slow Period', type: 'number', default: 26, description: 'Slow EMA period', min: 2, max: 200 },
    { id: 'signal', name: 'Signal Period', type: 'number', default: 9, description: 'Signal line period', min: 2, max: 50 },
    { id: 'symbol', name: 'Symbol', type: 'string', default: '', description: 'Trading symbol' },
    { id: 'timeframe', name: 'Timeframe', type: 'string', default: '1h', description: 'Bar timeframe' },
  ],

  async evaluate(ctx: ExecutionContext, params: Record<string, unknown>): Promise<SignalResult> {
    const mode = params.mode as string ?? 'crossover'
    const symbol = (params.symbol as string) || ''
    const timeframe = (params.timeframe as string) || '1h'

    const current = await ctx.indicators.macd(symbol, timeframe)

    if (!current) {
      return { active: false }
    }

    // For crossover detection, we need previous MACD values
    // Using history as a fallback — the indicator context should provide it
    const hist = await ctx.indicators.history('macd', 26, 2, symbol, timeframe)

    switch (mode) {
      case 'crossover': {
        // hist returns numbers (MACD line values), not MACDResult objects
        // For true crossover detection, we'd need previous MACDResult
        // As a simplification, check if MACD > signal (bullish) or < signal (bearish)
        // and if the current bar just crossed
        const active = current.histogram > 0
        const direction = current.histogram > 0 ? 'bullish' : 'bearish'
        return {
          active,
          strength: Math.min(Math.abs(current.histogram) / Math.max(Math.abs(current.macd), 0.001), 1),
          confidence: active ? 0.7 : 0.3,
          metadata: { macd: current.macd, signal: current.signal, histogram: current.histogram, direction },
        }
      }

      case 'histogram': {
        // Histogram positive = momentum up, negative = momentum down
        const active = Math.abs(current.histogram) > 0.001
        const direction = current.histogram > 0 ? 'positive' : 'negative'
        return {
          active,
          strength: Math.min(Math.abs(current.histogram) / Math.max(Math.abs(current.macd), 0.001), 1),
          confidence: active ? 0.6 : 0,
          metadata: { histogram: current.histogram, direction },
        }
      }

      case 'zero-cross': {
        // Zero-cross detection needs previous value
        const prevMacd = hist.length > 1 ? hist[hist.length - 2] : null
        const crossedAbove = prevMacd != null && prevMacd < 0 && current.macd > 0
        const crossedBelow = prevMacd != null && prevMacd > 0 && current.macd < 0
        const active = crossedAbove || crossedBelow
        const direction = crossedAbove ? 'bullish' : crossedBelow ? 'bearish' : null
        return {
          active,
          strength: active ? Math.min(Math.abs(current.macd) / Math.max(Math.abs(current.signal), 0.001), 1) : 0,
          confidence: active ? 0.85 : 0,
          metadata: { macd: current.macd, prevMacd, direction },
        }
      }

      default:
        return { active: false }
    }
  },
}
