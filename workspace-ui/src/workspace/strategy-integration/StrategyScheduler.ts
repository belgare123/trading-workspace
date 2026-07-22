// ── StrategyScheduler — event-driven execution ──
// Sprint 5.7 — StrategyRuntime Integration

import type { StrategyContext, StrategyTick, StrategyCandle, ScheduleConfig } from './types'
import { StrategyContextFactory } from './StrategyContext'
import type { WalletSnapshot } from '../wallet/types'

export type TickHandler = (ctx: StrategyContext) => void

interface Subscription {
  symbol: string
  timeframe: string
  handler: TickHandler
  config: ScheduleConfig
}

/**
 * StrategyScheduler — manages tick/candle subscriptions for strategies.
 *
 * Receives market data ticks and builds StrategyContext for each subscription.
 */
export class StrategyScheduler {
  private readonly _subscriptions = new Map<string, Subscription[]>() // symbol → subscriptions
  private readonly _contextFactory = new StrategyContextFactory()
  private readonly _getWallet: () => WalletSnapshot
  private readonly _getHasOpenTrade: (symbol: string) => boolean
  private readonly _getHasPendingOrder: (symbol: string) => boolean
  private readonly _candleCache = new Map<string, StrategyCandle[]>() // `${symbol}:${timeframe}` → candles

  constructor(deps: {
    getWallet: () => WalletSnapshot
    getHasOpenTrade: (symbol: string) => boolean
    getHasPendingOrder: (symbol: string) => boolean
  }) {
    this._getWallet = deps.getWallet
    this._getHasOpenTrade = deps.getHasOpenTrade
    this._getHasPendingOrder = deps.getHasPendingOrder
  }

  /**
   * Subscribe a handler to symbol/timeframe ticks.
   * Returns unsubscribe function.
   */
  subscribe(symbol: string, timeframe: string, handler: TickHandler): () => void {
    const key = symbol
    if (!this._subscriptions.has(key)) {
      this._subscriptions.set(key, [])
    }
    const subs = this._subscriptions.get(key)!
    const sub: Subscription = { symbol, timeframe, handler, config: { trigger: 'candle', timeframe } }
    subs.push(sub)
    return () => {
      const idx = subs.indexOf(sub)
      if (idx >= 0) subs.splice(idx, 1)
      if (subs.length === 0) this._subscriptions.delete(key)
    }
  }

  /** Unsubscribe a specific subscription */
  unsubscribe(symbol: string, timeframe: string): void {
    const key = symbol
    const subs = this._subscriptions.get(key)
    if (!subs) return
    const remaining = subs.filter(s => s.timeframe !== timeframe)
    if (remaining.length > 0) {
      this._subscriptions.set(key, remaining)
    } else {
      this._subscriptions.delete(key)
    }
  }

  /**
   * Process a market tick.
   * Builds StrategyContext and fires all subscriptions for the symbol.
   */
  onTick(tick: StrategyTick): void {
    const subs = this._subscriptions.get(tick.symbol)
    if (!subs) return

    for (const sub of subs) {
      this._updateCandleCache(sub.symbol, sub.timeframe, tick)
    }

    const wallet = this._getWallet()
    const allCandles = subs.length > 0
      ? this._getCandles(subs[0].symbol, subs[0].timeframe)
      : []

    for (const sub of subs) {
      const ctx = this._contextFactory.create({
        strategyId: sub.symbol,
        symbol: sub.symbol,
        tick,
        candles: allCandles,
        wallet,
        hasOpenTrade: this._getHasOpenTrade(sub.symbol),
        hasPendingOrder: this._getHasPendingOrder(sub.symbol),
      })
      sub.handler(ctx)
    }
  }

  /** Get candle history for a symbol/timeframe */
  getCandles(symbol: string, timeframe: string): readonly StrategyCandle[] {
    return this._candleCache.get(`${symbol}:${timeframe}`) ?? []
  }

  /** Number of active subscriptions */
  get subscriptionCount(): number {
    let count = 0
    for (const subs of this._subscriptions.values()) {
      count += subs.length
    }
    return count
  }

  private _getCandles(symbol: string, timeframe: string): StrategyCandle[] {
    return this._candleCache.get(`${symbol}:${timeframe}`) ?? []
  }

  private _updateCandleCache(symbol: string, timeframe: string, tick: StrategyTick): void {
    const key = `${symbol}:${timeframe}`
    let candles = this._candleCache.get(key)
    if (!candles) {
      candles = []
      this._candleCache.set(key, candles)
    }
    const lastCandle = candles[candles.length - 1]
    // Build a new candle on each tick (simplified — real impl would aggregate)
    if (!lastCandle) {
      candles.push({
        symbol, timeframe,
        open: tick.price, high: tick.price, low: tick.price,
        close: tick.price, volume: 0, timestamp: tick.timestamp,
      })
    } else {
      lastCandle.high = Math.max(lastCandle.high, tick.price)
      lastCandle.low = Math.min(lastCandle.low, tick.price)
      lastCandle.close = tick.price
    }
    // Keep last 100 candles
    if (candles.length > 100) candles.splice(0, candles.length - 100)
  }
}
