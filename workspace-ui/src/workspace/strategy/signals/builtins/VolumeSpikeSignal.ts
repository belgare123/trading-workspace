// ── VolumeSpikeSignal — detects unusual volume spikes ──
//
// Fires when current volume exceeds the average by the specified multiplier.
// Also detects volume dry-up (volume below threshold).
//
// @since 3.4.3

import type { SignalDefinition } from '../definition/SignalDefinition'
import type { ExecutionContext } from '../../context'
import type { SignalResult } from '../types'
import { normalize } from '../utils/SignalHelpers'

export const VolumeSpikeSignal: SignalDefinition = {
  id: 'volume-spike',
  name: 'Volume Spike',
  description: 'Detects unusual volume spikes or dry-ups',
  version: '1.0.0',
  parameters: [
    { id: 'mode', name: 'Mode', type: 'select', default: 'spike', description: 'Signal mode', options: ['spike', 'dry-up'] },
    { id: 'lookback', name: 'Lookback Bars', type: 'number', default: 20, description: 'Bars for average', min: 2, max: 200 },
    { id: 'multiplier', name: 'Multiplier', type: 'number', default: 2.0, description: 'Multiplier above average', min: 1, max: 10 },
    { id: 'symbol', name: 'Symbol', type: 'string', default: '', description: 'Trading symbol' },
    { id: 'timeframe', name: 'Timeframe', type: 'string', default: '1h', description: 'Bar timeframe' },
  ],

  async evaluate(ctx: ExecutionContext, params: Record<string, unknown>): Promise<SignalResult> {
    const mode = params.mode as string ?? 'spike'
    const lookback = (params.lookback as number) ?? 20
    const multiplier = (params.multiplier as number) ?? 2.0
    const symbol = (params.symbol as string) || ''
    const timeframe = (params.timeframe as string) || '1h'

    // Fetch bars for volume analysis
    const bars = await ctx.market.bars(symbol, timeframe, lookback + 1)
    if (bars.length < 2) return { active: false }

    // Latest bar volume
    const latest = bars[bars.length - 1]
    const prevBars = bars.slice(0, -1)

    // Average volume (excluding latest)
    const avgVolume = prevBars.reduce((sum, b) => sum + b.volume, 0) / prevBars.length

    if (mode === 'spike') {
      const threshold = avgVolume * multiplier
      const active = latest.volume > threshold
      const ratio = avgVolume > 0 ? latest.volume / avgVolume : 0
      return {
        active,
        strength: active ? normalize(ratio, multiplier, multiplier * 3) : 0,
        confidence: active ? normalize(ratio, multiplier, multiplier * 2) : 0,
        metadata: { volume: latest.volume, avgVolume, ratio, multiplier, threshold },
      }
    }

    if (mode === 'dry-up') {
      const ratio = avgVolume > 0 ? latest.volume / avgVolume : 1
      const active = ratio < (1 / multiplier)
      return {
        active,
        strength: active ? normalize(ratio, 0, 1 / multiplier) : 0,
        confidence: active ? normalize(ratio, 0, 1 / multiplier) : 0,
        metadata: { volume: latest.volume, avgVolume, ratio, type: 'dry-up' },
      }
    }

    return { active: false }
  },
}
