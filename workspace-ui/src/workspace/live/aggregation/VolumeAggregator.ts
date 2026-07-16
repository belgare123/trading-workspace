/**
 * VolumeAggregator.ts — Tracks volume statistics per symbol
 *
 * Computes rolling volume metrics: volume per timeframe,
 * volume delta, average trade size, and volume-weighted metrics.
 *
 * @since 4.2
 */

import type { TradeEvent } from '../types'

export interface VolumeStats {
  symbol: string
  volume1m: number
  volume5m: number
  volume15m: number
  volume1h: number
  volume24h: number
  tradeCount: number
  avgTradeSize: number
  buyVolume: number
  sellVolume: number
}

export class VolumeAggregator {
  private trades: TradeEvent[] = []
  private readonly MAX_TRADES = 10_000

  /** Record a trade */
  record(trade: TradeEvent): void {
    this.trades.push(trade)
    if (this.trades.length > this.MAX_TRADES) {
      this.trades.shift()
    }
  }

  /** Get volume statistics for a symbol */
  getStats(symbol: string): VolumeStats {
    const now = Date.now()
    const symbolTrades = this.trades.filter(t => t.symbol.toUpperCase() === symbol.toUpperCase())

    const ms = (minutes: number) => minutes * 60_000
    const inWindow = (trade: TradeEvent, windowMs: number) =>
      now - trade.timestamp <= windowMs

    const sumVolume = (trades: TradeEvent[]) =>
      trades.reduce((sum, t) => sum + t.quantity * t.price, 0)

    const trades1m = symbolTrades.filter(t => inWindow(t, ms(1)))
    const trades5m = symbolTrades.filter(t => inWindow(t, ms(5)))
    const trades15m = symbolTrades.filter(t => inWindow(t, ms(15)))
    const trades1h = symbolTrades.filter(t => inWindow(t, ms(60)))
    const trades24h = symbolTrades.filter(t => inWindow(t, ms(1440)))

    return {
      symbol: symbol.toUpperCase(),
      volume1m: sumVolume(trades1m),
      volume5m: sumVolume(trades5m),
      volume15m: sumVolume(trades15m),
      volume1h: sumVolume(trades1h),
      volume24h: sumVolume(trades24h),
      tradeCount: symbolTrades.length,
      avgTradeSize: symbolTrades.length > 0
        ? symbolTrades.reduce((s, t) => s + t.price * t.quantity, 0) / symbolTrades.length
        : 0,
      buyVolume: sumVolume(symbolTrades.filter(t => t.side === 'buy')),
      sellVolume: sumVolume(symbolTrades.filter(t => t.side === 'sell')),
    }
  }

  /** Clear all trade data */
  reset(): void {
    this.trades = []
  }
}
