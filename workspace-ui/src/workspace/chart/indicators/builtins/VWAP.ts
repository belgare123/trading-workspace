/**
 * VWAP.ts — Volume-Weighted Average Price
 *
 * Cumulative total of (price * volume) divided by cumulative volume.
 * VWAP resets at each session boundary (simplified: starts from first data point).
 * Uses typical price: (high + low + close) / 3.
 *
 * @since 3.3.3
 */

import type { IndicatorDefinition } from '../IndicatorDefinition'

function vwapCompute(data: import('../../types').OHLCV[], _params: Record<string, number>): number[][] {
  const result: number[] = []
  let cumPV = 0
  let cumVol = 0

  for (const d of data) {
    const typicalPrice = (d.high + d.low + d.close) / 3
    cumPV += typicalPrice * d.volume
    cumVol += d.volume

    if (cumVol > 0) {
      result.push(cumPV / cumVol)
    } else {
      result.push(NaN)
    }
  }

  return [result]
}

export const VWAP: IndicatorDefinition = {
  id: 'VWAP',
  name: 'Volume-Weighted Average Price',
  description: 'Cumulative typical price weighted by volume',
  params: [],
  outputs: [
    { name: 'vwap', label: 'VWAP', color: '#4dd0e1', lineStyle: 'solid', lineWidth: 1.5 },
  ],
  defaultParams: {},
  overlay: true,
  compute: vwapCompute,
}
