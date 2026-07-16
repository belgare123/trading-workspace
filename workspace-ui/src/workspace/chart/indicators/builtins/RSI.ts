/**
 * RSI.ts — Relative Strength Index
 *
 * Momentum oscillator measuring speed and change of price movements.
 * RSI = 100 - (100 / (1 + RS))
 * where RS = average gain / average loss over N periods using Wilder's smoothing.
 *
 * Default period: 14. Overbought: 70, Oversold: 30.
 * RSI is a subchart indicator (no price overlay).
 *
 * @since 3.3.3
 */

import type { IndicatorDefinition } from '../IndicatorDefinition'

function rsiCompute(data: import('../../types').OHLCV[], params: Record<string, number>): number[][] {
  const period = Math.max(1, Math.floor(params.period || 14))
  const source: number[] = data.map((d) => d.close)
  const result: number[] = []

  if (source.length < 2) {
    return [result.map(() => NaN)]
  }

  // Calculate price changes
  const gains: number[] = []
  const losses: number[] = []
  for (let i = 1; i < source.length; i++) {
    const change = source[i] - source[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? -change : 0)
  }

  // First RS uses simple average
  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period && i < gains.length; i++) {
    avgGain += gains[i]
    avgLoss += losses[i]
  }
  avgGain /= period
  avgLoss /= period

  // First RSI value
  if (avgLoss === 0) {
    result.push(100)
  } else {
    const rs = avgGain / avgLoss
    result.push(100 - 100 / (1 + rs))
  }

  // Pad preceding values with NaN
  for (let i = 0; i < period; i++) {
    result.unshift(NaN)
  }

  // Subsequent values use Wilder's smoothing
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period

    if (avgLoss === 0) {
      result.push(100)
    } else {
      const rs = avgGain / avgLoss
      result.push(100 - 100 / (1 + rs))
    }
  }

  return [result]
}

export const RSI: IndicatorDefinition = {
  id: 'RSI',
  name: 'Relative Strength Index',
  description: 'Momentum oscillator (0-100). Overbought > 70, Oversold < 30.',
  params: [
    { name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 100, step: 1 },
  ],
  outputs: [
    { name: 'rsi', label: 'RSI', color: '#81c784', lineStyle: 'solid', lineWidth: 1.5 },
  ],
  defaultParams: { period: 14 },
  overlay: false,
  compute: rsiCompute,
}
