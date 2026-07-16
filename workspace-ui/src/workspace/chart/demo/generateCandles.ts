/**
 * generateCandles.ts — mock OHLCV data generator for the Chart Sandbox
 *
 * Produces realistic-looking candlestick data using a random walk
 * with configurable volatility and gap handling.
 *
 * @since 3.3.2
 */

import type { OHLCV } from '../types'

export interface GenerateOptions {
  /** Number of candles to generate */
  count: number
  /** Base price to start from */
  basePrice: number
  /** Interval between candles in milliseconds */
  intervalMs: number
  /** Price volatility as fraction of price (default 0.002 = 0.2%) */
  volatility?: number
  /** End timestamp (default: now) */
  endTime?: number
  /** Optional seed for reproducible sequences (not yet implemented) */
  seed?: number
}

const DEFAULT_OPTIONS: Required<Omit<GenerateOptions, 'seed'>> = {
  count: 500,
  basePrice: 50_000,
  intervalMs: 60_000, // 1 minute
  volatility: 0.002,
  endTime: Date.now(),
}

/**
 * Generate a realistic sequence of OHLCV candles using a random walk.
 */
export function generateCandles(options: GenerateOptions): OHLCV[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const { count, basePrice, intervalMs, volatility, endTime } = opts

  const candles: OHLCV[] = []
  let price = basePrice
  let timestamp = endTime - count * intervalMs

  for (let i = 0; i < count; i++) {
    // Random walk with mean-reversion tendency
    const drift = (basePrice - price) * 0.0001 // weak pull toward base
    const shock = (Math.random() - 0.5) * 2 * volatility * price
    const change = drift + shock

    const open = price
    const close = price + change
    const high = Math.max(open, close) + Math.abs(shock) * 0.4 * Math.random()
    const low = Math.min(open, close) - Math.abs(shock) * 0.4 * Math.random()
    const volume = basePrice * 0.1 + Math.random() * basePrice * 0.2

    candles.push({
      timestamp,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: round(volume),
    })

    price = close
    timestamp += intervalMs
  }

  return candles
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
