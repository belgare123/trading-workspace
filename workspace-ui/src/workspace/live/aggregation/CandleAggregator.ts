/**
 * CandleAggregator.ts — Aggregates trade data into candlesticks
 *
 * Builds klines from raw trade events for timeframes
 * not provided directly by the exchange.
 *
 * @since 4.2
 */

import type { TradeEvent, KlineEvent, KlineInterval } from '../types'
import { TimeframeBuilder } from './TimeframeBuilder'

export class CandleAggregator {
  private builders = new Map<string, TimeframeBuilder>()
  private intervals: KlineInterval[] = ['5m', '15m', '30m', '1h', '4h']

  /** Set which intervals to aggregate */
  setIntervals(intervals: KlineInterval[]): void {
    this.intervals = intervals
  }

  /** Aggregate a trade event */
  aggregate(trade: TradeEvent): KlineEvent[] {
    const symbol = trade.symbol.toUpperCase()
    const generated: KlineEvent[] = []

    for (const interval of this.intervals) {
      const key = `${symbol}:${interval}`
      if (!this.builders.has(key)) {
        this.builders.set(key, new TimeframeBuilder(symbol, interval))
      }
      const builder = this.builders.get(key)!
      const result = builder.addTrade(trade)
      if (result) {
        generated.push(result)
      }
    }

    return generated
  }

  /** Get current kline for a symbol/interval without closing it */
  peek(symbol: string, interval: KlineInterval): KlineEvent | undefined {
    const key = `${symbol.toUpperCase()}:${interval}`
    return this.builders.get(key)?.current
  }

  /** Get all current incomplete klines */
  getAllCurrent(): KlineEvent[] {
    const result: KlineEvent[] = []
    for (const builder of this.builders.values()) {
      if (builder.current) {
        result.push(builder.current)
      }
    }
    return result
  }

  /** Reset all aggregation */
  reset(): void {
    this.builders.clear()
  }
}
