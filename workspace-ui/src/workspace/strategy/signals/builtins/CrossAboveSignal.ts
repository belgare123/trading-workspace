// ── CrossAboveSignal — fires when value A crosses above value B ──
// Compares two price/indicator values. Fires when the first exceeds the second
// on the current bar after being below (or equal) on the previous bar.
//
// Parameters:
//   sourceA     - first value source ('price', 'sma_20', 'sma_50', 'ema_20', ...)
//   sourceB     - second value source
//   symbol      - symbol to evaluate
//   timeframe   - timeframe for bars
//
// @since 3.4.3

import type { SignalDefinition } from '../definition/SignalDefinition'
import type { ExecutionContext } from '../../context'
import type { SignalResult } from '../types'
import { getIndicatorValue } from '../utils/SignalHelpers'

export const CrossAboveSignal: SignalDefinition = {
  id: 'cross-above',
  name: 'Cross Above',
  description: 'Fires when value A crosses above value B',
  version: '1.0.0',
  parameters: [
    { id: 'sourceA', name: 'Source A', type: 'select', default: 'price', description: 'First value source', options: ['price', 'sma_20', 'sma_50', 'ema_12', 'ema_26', 'rsi_14'] },
    { id: 'sourceB', name: 'Source B', type: 'select', default: 'sma_20', description: 'Second value source', options: ['price', 'sma_20', 'sma_50', 'ema_12', 'ema_26', 'rsi_14'] },
    { id: 'symbol', name: 'Symbol', type: 'string', default: '', description: 'Trading symbol' },
    { id: 'timeframe', name: 'Timeframe', type: 'string', default: '1h', description: 'Bar timeframe' },
  ],

  async evaluate(ctx: ExecutionContext, params: Record<string, unknown>): Promise<SignalResult> {
    const sourceA = params.sourceA as string ?? 'price'
    const sourceB = params.sourceB as string ?? 'sma_20'
    const symbol = (params.symbol as string) || ''
    const timeframe = (params.timeframe as string) || '1h'

    const [currentA, currentB, prevA, prevB] = await Promise.all([
      getIndicatorValue(ctx, sourceA, symbol, timeframe, 0),
      getIndicatorValue(ctx, sourceB, symbol, timeframe, 0),
      getIndicatorValue(ctx, sourceA, symbol, timeframe, 1),
      getIndicatorValue(ctx, sourceB, symbol, timeframe, 1),
    ])

    if (currentA == null || currentB == null || prevA == null || prevB == null) {
      return { active: false }
    }

    const crossedAbove = prevA <= prevB && currentA > currentB
    const strength = crossedAbove
      ? Math.min(Math.abs(currentA - currentB) / Math.max(Math.abs(currentB), 0.001), 1)
      : 0

    return {
      active: crossedAbove,
      strength,
      confidence: strength,
      metadata: { currentA, currentB, prevA, prevB },
    }
  },
}
