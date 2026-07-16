/**
 * SMA.ts — Simple Moving Average
 *
 * Computes the arithmetic mean over a sliding window.
 * Default period: 20.
 *
 * @since 3.3.3
 */

import type { IndicatorDefinition } from '../IndicatorDefinition'

function smaCompute(data: import('../../types').OHLCV[], params: Record<string, number>): number[][] {
  const period = Math.max(1, Math.floor(params.period || 20))
  const source: number[] = data.map((d) => d.close)
  const result: number[] = []

  for (let i = 0; i < source.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
      continue
    }
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += source[j]
    }
    result.push(sum / period)
  }

  return [result]
}

export const SMA: IndicatorDefinition = {
  id: 'SMA',
  name: 'Simple Moving Average',
  description: 'Arithmetic mean of closing prices over N periods',
  params: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 },
  ],
  outputs: [
    { name: 'sma', label: 'SMA', color: '#f06292', lineStyle: 'solid', lineWidth: 1.5 },
  ],
  defaultParams: { period: 20 },
  overlay: true,
  compute: smaCompute,
}
