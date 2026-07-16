// ── NewHighSignal — detects new highs/lows over N bars ──
//
// Fires when the current bar makes a new N-bar high or low.
// Includes session-based variants (new day/week high).
//
// @since 3.4.3

import type { SignalDefinition } from '../definition/SignalDefinition'
import type { ExecutionContext } from '../../context'
import type { SignalResult } from '../types'
import { normalize, linearConfidence } from '../utils/SignalHelpers'

export const NewHighSignal: SignalDefinition = {
  id: 'new-high',
  name: 'New High/Low',
  description: 'Detects new N-bar highs or lows',
  version: '1.0.0',
  parameters: [
    { id: 'mode', name: 'Mode', type: 'select', default: 'high', description: 'Direction', options: ['high', 'low'] },
    { id: 'lookback', name: 'Lookback Bars', type: 'number', default: 20, description: 'Bars for range', min: 2, max: 200 },
    { id: 'symbol', name: 'Symbol', type: 'string', default: '', description: 'Trading symbol' },
    { id: 'timeframe', name: 'Timeframe', type: 'string', default: '1h', description: 'Bar timeframe' },
  ],

  async evaluate(ctx: ExecutionContext, params: Record<string, unknown>): Promise<SignalResult> {
    const mode = params.mode as string ?? 'high'
    const lookback = (params.lookback as number) ?? 20
    const symbol = (params.symbol as string) || ''
    const timeframe = (params.timeframe as string) || '1h'

    // Fetch lookback+1 bars
    const bars = await ctx.market.bars(symbol, timeframe, lookback + 1)
    if (bars.length < 2) return { active: false }

    const latest = bars[bars.length - 1]
    const prevBars = bars.slice(0, -1)

    // Previous close prices for new high/low check
    const prevCloses = prevBars.map(b => b.close)

    if (mode === 'high') {
      const prevHigh = Math.max(...prevCloses)
      const signal = latest.close > prevHigh
      const strength = signal ? normalize(latest.close, prevHigh, prevHigh * 1.05) : 0
      return {
        active: signal,
        strength,
        confidence: signal ? linearConfidence(latest.close, prevHigh, prevHigh * 1.03) : 0,
        metadata: { price: latest.close, prevHigh, type: 'new-high', lookback },
      }
    }

    if (mode === 'low') {
      const prevLow = Math.min(...prevCloses)
      const signal = latest.close < prevLow
      const strength = signal ? normalize(latest.close, prevLow * 1.05, prevLow) : 0
      return {
        active: signal,
        strength,
        confidence: signal ? linearConfidence(latest.close, prevLow * 1.03, prevLow) : 0,
        metadata: { price: latest.close, prevLow, type: 'new-low', lookback },
      }
    }

    return { active: false }
  },
}
