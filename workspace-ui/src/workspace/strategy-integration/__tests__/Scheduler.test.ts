// ── StrategyScheduler & StrategyContext unit tests ──
// Sprint 5.7

import { describe, it, expect, vi } from 'vitest'
import { StrategyScheduler } from '../StrategyScheduler'
import { StrategyContextFactory } from '../StrategyContext'
import type { StrategyTick, StrategyContext, StrategyCandle } from '../types'

describe('StrategyScheduler', () => {
  it('subscribes and fires handler on tick', () => {
    const handler = vi.fn()
    const scheduler = new StrategyScheduler({
      getWallet: () => ({ total: 10000, free: 5000, locked: 0, equity: 10000, unrealizedPnL: 0, realizedPnL: 0 }),
      getHasOpenTrade: () => false,
      getHasPendingOrder: () => false,
    })

    const unsub = scheduler.subscribe('BTCUSDT', '1m', handler)

    scheduler.onTick({
      symbol: 'BTCUSDT',
      price: 50000,
      bid: 49990,
      ask: 50010,
      timestamp: Date.now(),
    })

    expect(handler).toHaveBeenCalledOnce()
    const ctx: StrategyContext = handler.mock.calls[0][0]
    expect(ctx.symbol).toBe('BTCUSDT')
    expect(ctx.tick.price).toBe(50000)
    expect(ctx.wallet.total).toBe(10000)

    unsub()
    scheduler.onTick({ symbol: 'BTCUSDT', price: 50100, bid: 50090, ask: 50110, timestamp: Date.now() })
    expect(handler).toHaveBeenCalledOnce() // unsubscribed, no new calls
  })

  it('unsubscribe removes specific subscription', () => {
    const handler = vi.fn()
    const scheduler = new StrategyScheduler({
      getWallet: () => ({ total: 10000, free: 5000, locked: 0, equity: 10000, unrealizedPnL: 0, realizedPnL: 0 }),
      getHasOpenTrade: () => false,
      getHasPendingOrder: () => false,
    })

    scheduler.subscribe('BTCUSDT', '1m', handler)
    scheduler.unsubscribe('BTCUSDT', '1m')

    scheduler.onTick({ symbol: 'BTCUSDT', price: 50000, bid: 49990, ask: 50010, timestamp: Date.now() })
    expect(handler).not.toHaveBeenCalled()
  })

  it('tracks open trade and pending order state', () => {
    const hasOpenTrade = vi.fn().mockReturnValue(true)
    const hasPendingOrder = vi.fn().mockReturnValue(false)
    const handler = vi.fn()

    const scheduler = new StrategyScheduler({
      getWallet: () => ({ total: 10000, free: 5000, locked: 0, equity: 10000, unrealizedPnL: 0, realizedPnL: 0 }),
      getHasOpenTrade: hasOpenTrade,
      getHasPendingOrder: hasPendingOrder,
    })

    scheduler.subscribe('BTCUSDT', '1m', handler)
    scheduler.onTick({ symbol: 'BTCUSDT', price: 50000, bid: 49990, ask: 50010, timestamp: Date.now() })

    expect(hasOpenTrade).toHaveBeenCalledWith('BTCUSDT')
    expect(handler.mock.calls[0][0].hasOpenTrade).toBe(true)
    expect(handler.mock.calls[0][0].hasPendingOrder).toBe(false)
  })

  it('maintains candle cache', () => {
    const scheduler = new StrategyScheduler({
      getWallet: () => ({ total: 10000, free: 5000, locked: 0, equity: 10000, unrealizedPnL: 0, realizedPnL: 0 }),
      getHasOpenTrade: () => false,
      getHasPendingOrder: () => false,
    })

    scheduler.subscribe('BTCUSDT', '1m', vi.fn())
    scheduler.onTick({ symbol: 'BTCUSDT', price: 50000, bid: 49990, ask: 50010, timestamp: 1000 })
    scheduler.onTick({ symbol: 'BTCUSDT', price: 50100, bid: 50090, ask: 50110, timestamp: 2000 })
    scheduler.onTick({ symbol: 'BTCUSDT', price: 50200, bid: 50190, ask: 50210, timestamp: 3000 })

    const candles = scheduler.getCandles('BTCUSDT', '1m')
    expect(candles.length).toBe(1) // same candle aggregated
    expect(candles[0].high).toBe(50200)
    expect(candles[0].low).toBe(50000)
    expect(candles[0].close).toBe(50200)
  })

  it('reports subscription count', () => {
    const scheduler = new StrategyScheduler({
      getWallet: () => ({ total: 10000, free: 5000, locked: 0, equity: 10000, unrealizedPnL: 0, realizedPnL: 0 }),
      getHasOpenTrade: () => false,
      getHasPendingOrder: () => false,
    })

    expect(scheduler.subscriptionCount).toBe(0)
    scheduler.subscribe('BTCUSDT', '1m', vi.fn())
    expect(scheduler.subscriptionCount).toBe(1)
    scheduler.subscribe('ETHUSDT', '1m', vi.fn())
    expect(scheduler.subscriptionCount).toBe(2)
  })
})

describe('StrategyContextFactory', () => {
  it('creates context with all fields', () => {
    const factory = new StrategyContextFactory()
    const tick: StrategyTick = { symbol: 'BTCUSDT', price: 50000, bid: 49990, ask: 50010, timestamp: 1000 }
    const candles: StrategyCandle[] = [{ symbol: 'BTCUSDT', timeframe: '1m', open: 49500, high: 50500, low: 49400, close: 50000, volume: 1000, timestamp: 1000 }]
    const wallet = { total: 10000, free: 5000, locked: 0, equity: 10000, unrealizedPnL: 0, realizedPnL: 0 }

    const ctx = factory.create({
      strategyId: 'sma-cross',
      symbol: 'BTCUSDT',
      tick,
      candles,
      wallet,
      hasOpenTrade: true,
      hasPendingOrder: false,
    })

    expect(ctx.strategyId).toBe('sma-cross')
    expect(ctx.symbol).toBe('BTCUSDT')
    expect(ctx.tick.price).toBe(50000)
    expect(ctx.candles).toHaveLength(1)
    expect(ctx.candles[0].high).toBe(50500)
    expect(ctx.wallet.equity).toBe(10000)
    expect(ctx.hasOpenTrade).toBe(true)
    expect(ctx.hasPendingOrder).toBe(false)
    expect(ctx.clock).toBeGreaterThan(0)
  })
})
