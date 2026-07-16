/**
 * MACD.ts — Moving Average Convergence Divergence
 *
 * Trend-following momentum indicator showing relationship between
 * two EMAs of the price.
 *
 * Outputs:
 *   - MACD line: EMA(fast) - EMA(slow)
 *   - Signal line: EMA(macd, period)
 *   - Histogram: MACD line - Signal line
 *
 * Default params: fast=12, slow=26, signal=9
 * MACD is a subchart indicator (no price overlay).
 *
 * @since 3.3.3
 */

import type { IndicatorDefinition } from '../IndicatorDefinition'

function ema(values: number[], period: number): number[] {
  const result: number[] = []
  const k = 2 / (period + 1)
  const seedCount = Math.min(period, values.length)

  // Seed with SMA
  let sum = 0
  for (let i = 0; i < seedCount; i++) sum += values[i]
  result.push(sum / seedCount)

  for (let i = 1; i < values.length; i++) {
    if (i < seedCount) {
      sum += values[i]
      result.push(sum / (i + 1))
    } else {
      result.push(values[i] * k + result[i - 1] * (1 - k))
    }
  }

  return result
}

function macdCompute(data: import('../../types').OHLCV[], params: Record<string, number>): number[][] {
  const fast = Math.max(1, Math.floor(params.fastLength || 12))
  const slow = Math.max(2, Math.floor(params.slowLength || 26))
  const signal = Math.max(1, Math.floor(params.signalLength || 9))

  if (fast >= slow) {
    // Fallback: ensure fast < slow
    return [data.map(() => NaN), data.map(() => NaN), data.map(() => NaN)]
  }

  const source: number[] = data.map((d) => d.close)

  // Compute EMAs
  const fastEMA = ema(source, fast)
  const slowEMA = ema(source, slow)

  // MACD line = fastEMA - slowEMA
  const macdLine: number[] = []
  for (let i = 0; i < source.length; i++) {
    const val = (fastEMA[i] ?? NaN) - (slowEMA[i] ?? NaN)
    macdLine.push(val)
  }

  // Signal line = EMA of MACD line
  const signalLine: number[] = []
  const k = 2 / (signal + 1)
  let sum = 0
  for (let i = 0; i < Math.min(signal, macdLine.length); i++) sum += macdLine[i]
  signalLine.push(sum / Math.min(signal, macdLine.length))
  for (let i = 1; i < macdLine.length; i++) {
    signalLine.push(macdLine[i] * k + signalLine[i - 1] * (1 - k))
  }

  // Histogram = MACD line - Signal line
  const histogram: number[] = []
  for (let i = 0; i < source.length; i++) {
    const val = (macdLine[i] ?? NaN) - (signalLine[i] ?? NaN)
    histogram.push(val)
  }

  return [macdLine, signalLine, histogram]
}

export const MACD: IndicatorDefinition = {
  id: 'MACD',
  name: 'Moving Average Convergence Divergence',
  description: 'Trend momentum: MACD line, Signal line, and Histogram',
  params: [
    { name: 'fastLength', label: 'Fast Length', type: 'number', default: 12, min: 1, max: 100, step: 1 },
    { name: 'slowLength', label: 'Slow Length', type: 'number', default: 26, min: 2, max: 200, step: 1 },
    { name: 'signalLength', label: 'Signal Length', type: 'number', default: 9, min: 1, max: 100, step: 1 },
  ],
  outputs: [
    { name: 'macd', label: 'MACD', color: '#64b5f6', lineStyle: 'solid', lineWidth: 1.5 },
    { name: 'signal', label: 'Signal', color: '#ffb74d', lineStyle: 'solid', lineWidth: 1.5 },
    { name: 'histogram', label: 'Histogram', color: '#90a4ae', lineStyle: 'solid', lineWidth: 0.5 },
  ],
  defaultParams: { fastLength: 12, slowLength: 26, signalLength: 9 },
  overlay: false,
  compute: macdCompute,
}
