// ── BollingerSignal — Bollinger Band touch / breakout / squeeze ──
//
// Modes:
//   'touch-upper'   — price touches or breaks above upper band
//   'touch-lower'   — price touches or breaks below lower band
//   'squeeze'       — band width contracts (low volatility setup)
//   'expand'        — band width expands (high volatility breakout)
//
// @since 3.4.3

import type { SignalDefinition } from '../definition/SignalDefinition'
import type { ExecutionContext } from '../../context'
import type { SignalResult } from '../types'
import { normalize, linearConfidence } from '../utils/SignalHelpers'

export const BollingerSignal: SignalDefinition = {
  id: 'bollinger',
  name: 'Bollinger Bands',
  description: 'Bollinger Band touch, breakout, squeeze and expansion signals',
  version: '1.0.0',
  parameters: [
    { id: 'mode', name: 'Mode', type: 'select', default: 'touch-upper', description: 'Signal mode', options: ['touch-upper', 'touch-lower', 'squeeze', 'expand'] },
    { id: 'period', name: 'Period', type: 'number', default: 20, description: 'SMA period', min: 2, max: 200 },
    { id: 'stdDev', name: 'Std Dev', type: 'number', default: 2, description: 'Standard deviations', min: 0.5, max: 4 },
    { id: 'squeezeThreshold', name: 'Squeeze Threshold', type: 'number', default: 0.8, description: 'Percentile for squeeze detection (0-1)', min: 0.1, max: 1 },
    { id: 'symbol', name: 'Symbol', type: 'string', default: '', description: 'Trading symbol' },
    { id: 'timeframe', name: 'Timeframe', type: 'string', default: '1h', description: 'Bar timeframe' },
  ],

  async evaluate(ctx: ExecutionContext, params: Record<string, unknown>): Promise<SignalResult> {
    const mode = params.mode as string ?? 'touch-upper'
    const period = (params.period as number) ?? 20
    const stdDev = (params.stdDev as number) ?? 2
    const symbol = (params.symbol as string) || ''
    const timeframe = (params.timeframe as string) || '1h'

    const bands = await ctx.indicators.bollinger(period, stdDev, symbol, timeframe)
    if (!bands) return { active: false }

    const price = await ctx.market.price(symbol)
    if (price == null) return { active: false }

    // Band width for squeeze/expansion
    const width = bands.upper - bands.lower
    const midBand = bands.middle

    switch (mode) {
      case 'touch-upper': {
        const ratio = price / bands.upper
        const active = ratio >= 0.98
        const strength = active ? normalize(ratio, 0.98, 1.02) : 0
        return {
          active,
          strength,
          confidence: linearConfidence(price, bands.upper * 0.98, bands.upper * 1.02),
          metadata: { price, upper: bands.upper, middle: bands.middle, lower: bands.lower, ratio },
        }
      }

      case 'touch-lower': {
        const ratio = price / bands.lower
        const active = ratio <= 1.02
        const strength = active ? normalize(1, 0.98, 1.02) : 0
        return {
          active,
          strength,
          confidence: linearConfidence(price, bands.lower * 0.98, bands.lower * 1.02),
          metadata: { price, upper: bands.upper, middle: bands.middle, lower: bands.lower, ratio },
        }
      }

      case 'squeeze': {
        // Squeeze when band width is at its lowest percentile
        const active = width / midBand < 0.05
        return {
          active,
          strength: active ? normalize(width / midBand, 0, 0.05) : 0,
          confidence: active ? 0.65 : 0,
          metadata: { width: width / midBand, upper: bands.upper, lower: bands.lower, middle: bands.middle },
        }
      }

      case 'expand': {
        // Expansion when band width increases significantly
        const active = width / midBand > 0.1
        return {
          active,
          strength: active ? normalize(width / midBand, 0.1, 0.2) : 0,
          confidence: active ? 0.6 : 0,
          metadata: { width: width / midBand, upper: bands.upper, lower: bands.lower, middle: bands.middle },
        }
      }

      default:
        return { active: false }
    }
  },
}
