/**
 * EMA.ts — Exponential Moving Average
 *
 * Weighted moving average that gives more weight to recent prices.
 * Uses the standard formula: EMA = Price * k + EMA(prev) * (1 - k)
 * where k = 2 / (period + 1).
 *
 * Default period: 20.
 *
 * @since 3.3.3
 */

import type { IndicatorDefinition } from '../IndicatorDefinition'

function emaCompute(data: import('../../types').OHLCV[], params: Record<string, number>): number[][] {
  const period = Math.max(1, Math.floor(params.period || 20))
  const source: number[] = data.map((d) => d.close)
  const result: number[] = []
  const k = 2 / (period + 1)

  for (let i = 0; i < source.length; i++) {
    if (i === 0) {
      // First value is SMA of first `period` values (or source[0] if not enough data)
      if (source.length >= period) {
        let sum = 0
        for (let j = 0; j < period; j++) sum += source[j]
        result.push(sum / period)
      } else {
        result.push(source[0])
      }
    } else if (i < period - 1) {
      // Seed with SMA until we have enough data
      let sum = 0
      for (let j = 0; j <= i; j++) sum += source[j]
      result.push(sum / (i + 1))
    } else {
      const prev = result[i - 1]
      result.push(source[i] * k + prev * (1 - k))
    }
  }

  return [result]
}

export const EMA: IndicatorDefinition = {
  id: 'EMA',
  name: 'Exponential Moving Average',
  description: 'Weighted moving average with exponential decay',
  params: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 },
  ],
  outputs: [
    { name: 'ema', label: 'EMA', color: '#ce93d8', lineStyle: 'solid', lineWidth: 1.5 },
  ],
  defaultParams: { period: 20 },
  overlay: true,
  compute: emaCompute,
}
