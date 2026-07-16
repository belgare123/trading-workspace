// ── SignalHelpers — async utilities for signal evaluation ──
// Pure helper functions that assist built-in signals.
// No state, no side effects.
//
// @since 3.4.3

import type { ExecutionContext } from '../../context'

/** Mapping of named indicator sources to their IndicatorContext methods */
const SOURCE_MAP: Record<string, { fn: string; period?: number }> = {
  price:     { fn: 'price' },  // special case — handled in getIndicatorValue
  sma_20:    { fn: 'sma', period: 20 },
  sma_50:    { fn: 'sma', period: 50 },
  sma_200:   { fn: 'sma', period: 200 },
  ema_12:    { fn: 'ema', period: 12 },
  ema_26:    { fn: 'ema', period: 26 },
  ema_50:    { fn: 'ema', period: 50 },
  rsi_14:    { fn: 'rsi', period: 14 },
  rsi_7:     { fn: 'rsi', period: 7 },
  atr_14:    { fn: 'atr', period: 14 },
}

/**
 * Get a numeric value from a named indicator source.
 * Handles both current (offset=0) and historical (offset>0) values.
 * Returns null if the source is not recognised or data is unavailable.
 */
export async function getIndicatorValue(
  ctx: ExecutionContext,
  source: string,
  symbol: string,
  timeframe: string,
  offset: number = 0,
): Promise<number | null> {
  if (source === 'price') {
    return getPriceValue(ctx, symbol, timeframe, offset)
  }

  const mapping = SOURCE_MAP[source]
  if (!mapping) return null

  const period = mapping.period ?? 14

  if (offset > 0) {
    // Fetch history for the previous values
    const hist = await ctx.indicators.history(mapping.fn, period, offset + 1, symbol, timeframe)
    if (hist.length > offset) {
      return hist[hist.length - 1 - offset]
    }
    return null
  }

  // Current value — call the indicator method dynamically
  return callIndicator(ctx, mapping.fn, period, symbol, timeframe)
}

/**
 * Get price value (close) from market bars.
 */
async function getPriceValue(
  ctx: ExecutionContext,
  symbol: string,
  timeframe: string,
  offset: number = 0,
): Promise<number | null> {
  const bars = await ctx.market.bars(symbol, timeframe, offset + 1)
  if (bars.length === 0) return null
  // Last bar = most recent
  const idx = bars.length - 1 - offset
  return idx >= 0 ? bars[idx].close : null
}

/**
 * Call an indicator method dynamically by name.
 */
async function callIndicator(
  ctx: ExecutionContext,
  fnName: string,
  period: number,
  symbol: string,
  timeframe: string,
): Promise<number | null> {
  const indicators = ctx.indicators as unknown as Record<string, (...args: unknown[]) => Promise<number>>
  const fn = indicators[fnName]
  if (typeof fn !== 'function') return null
  try {
    // period is first param, symbol and timeframe are optional
    return await fn.call(ctx.indicators, period, symbol || undefined, timeframe || undefined)
  } catch {
    return null
  }
}

/**
 * Normalize a value to the 0–1 range.
 */
export function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0.5
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

/**
 * Linear interpolation for confidence scoring.
 */
export function linearConfidence(value: number, threshold: number, maxValue: number): number {
  if (value <= threshold) return 0
  if (value >= maxValue) return 1
  return (value - threshold) / (maxValue - threshold)
}

/**
 * Calculate direction of MACD crossover.
 * Returns 'bullish' | 'bearish' | null
 */
export function macdCrossover(
  current: { macd: number; signal: number },
  previous: { macd: number; signal: number } | null,
): 'bullish' | 'bearish' | null {
  if (!previous) return null
  const wasBelow = previous.macd <= previous.signal
  const isAbove = current.macd > current.signal
  if (wasBelow && isAbove) return 'bullish'
  const wasAbove = previous.macd >= previous.signal
  const isBelow = current.macd < current.signal
  if (wasAbove && isBelow) return 'bearish'
  return null
}

/**
 * Check if price is at a new high/low over N bars.
 */
export function isNewHighLow(
  currentPrice: number,
  prices: number[],
  direction: 'high' | 'low',
): boolean {
  if (prices.length === 0) return true
  return direction === 'high'
    ? currentPrice >= Math.max(...prices)
    : currentPrice <= Math.min(...prices)
}
