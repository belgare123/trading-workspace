// ── BreakoutSignal — price breakout / breakdown over N bars ──
//
// Fires when price breaks above (breakout) or below (breakdown)
// the highest high / lowest low of the lookback period.
//
// @since 3.4.3

import type { SignalDefinition } from '../definition/SignalDefinition'
import type { ExecutionContext } from '../../context'
import type { SignalResult } from '../types'
import { normalize } from '../utils/SignalHelpers'

export const BreakoutSignal: SignalDefinition = {
  id: 'breakout',
  name: 'Breakout',
  description: 'Price breakout above/below recent range',
  version: '1.0.0',
  parameters: [
    { id: 'mode', name: 'Mode', type: 'select', default: 'breakout', description: 'Direction', options: ['breakout', 'breakdown'] },
    { id: 'lookback', name: 'Lookback Bars', type: 'number', default: 20, description: 'Number of bars for range', min: 2, max: 200 },
    { id: 'multiplier', name: 'Multiplier', type: 'number', default: 1.0, description: 'ATR multiplier for confirmation', min: 0, max: 5 },
    { id: 'symbol', name: 'Symbol', type: 'string', default: '', description: 'Trading symbol' },
    { id: 'timeframe', name: 'Timeframe', type: 'string', default: '1h', description: 'Bar timeframe' },
  ],

  async evaluate(ctx: ExecutionContext, params: Record<string, unknown>): Promise<SignalResult> {
    const mode = params.mode as string ?? 'breakout'
    const lookback = (params.lookback as number) ?? 20
    const symbol = (params.symbol as string) || ''
    const timeframe = (params.timeframe as string) || '1h'

    // Get lookback+1 bars to check breakout on the latest bar
    const bars = await ctx.market.bars(symbol, timeframe, lookback + 1)
    if (bars.length < 2) return { active: false }

    // Latest bar
    const latest = bars[bars.length - 1]

    // Lookback bars (excluding the latest)
    const rangeBars = bars.slice(0, -1)
    const rangeHigh = Math.max(...rangeBars.map(b => b.high))
    const rangeLow = Math.min(...rangeBars.map(b => b.low))

    // Get ATR for confirmation
    const atr = await ctx.indicators.atr(14, symbol, timeframe)

    if (mode === 'breakout') {
      const breakoutPrice = rangeHigh + (atr ?? 0) * (params.multiplier as number ?? 1.0)
      const active = latest.close > breakoutPrice
      return {
        active,
        strength: active ? normalize(latest.close, rangeHigh, breakoutPrice + (atr ?? rangeHigh)) : 0,
        confidence: active ? normalize(latest.close, rangeHigh, rangeHigh * 1.05) : 0,
        metadata: { price: latest.close, rangeHigh, atr, type: 'breakout' },
      }
    }

    if (mode === 'breakdown') {
      const breakdownPrice = rangeLow - (atr ?? 0) * (params.multiplier as number ?? 1.0)
      const active = latest.close < breakdownPrice
      return {
        active,
        strength: active ? normalize(latest.close, breakdownPrice - (atr ?? rangeHigh), breakdownPrice) : 0,
        confidence: active ? normalize(latest.close, rangeLow, breakdownPrice) : 0,
        metadata: { price: latest.close, rangeLow, atr, type: 'breakdown' },
      }
    }

    return { active: false }
  },
}
