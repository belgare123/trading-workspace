// ── SmaCross strategy unit tests ──
// Sprint 5.7

import { describe, it, expect, beforeEach } from 'vitest'
import { SmaCross } from '../definitions/SmaCross'
import type { StrategyBar } from '../definition'
import type { StrategySignal } from '../types'

describe('SmaCross', () => {
  let strategy: SmaCross

  beforeEach(() => {
    strategy = new SmaCross()
  })

  it('has correct definition metadata', () => {
    expect(strategy.id).toBe('sma-cross')
    expect(strategy.name).toBe('SMA Crossover')
    expect(strategy.version).toBe('1.0.0')
  })

  it('creates initial state with correct defaults', () => {
    const state = strategy.create({ state: {} } as any, {})
    expect(state.fastPeriod).toBe(10)
    expect(state.slowPeriod).toBe(30)
    expect(state.prevFastAboveSlow).toBe(false)
    expect(Array.isArray(state.bars)).toBe(true)
  })

  it('accepts parameter overrides', () => {
    const state = strategy.create({ state: {} } as any, { fastPeriod: 5, slowPeriod: 20 })
    expect(state.fastPeriod).toBe(5)
    expect(state.slowPeriod).toBe(20)
  })

  it('returns null when not enough bars', () => {
    const state = strategy.create({ state: {} } as any, { fastPeriod: 3, slowPeriod: 5 })
    const bar: StrategyBar = { open: 100, high: 100, low: 100, close: 100, volume: 100, timestamp: Date.now() }
    const signal = strategy.onBar(
      { bar, bars: [], timestamp: bar.timestamp },
      { state, market: {}, orders: {}, position: {}, portfolio: {}, time: {}, indicators: {} } as any,
    )
    expect(signal).toBeNull()
  })

  it('generates buy signal on fast MA crossing above slow MA (uptrend)', () => {
    const state = strategy.create({ state: {} } as any, { fastPeriod: 3, slowPeriod: 5 })

    // 5 flat bars then 5 uptrend bars
    const prices = [
      100, 100, 100, 100, 100,
      101, 102, 103, 104, 105,
    ]

    let signals: StrategySignal[] = []
    for (const price of prices) {
      const bar: StrategyBar = { open: price, high: price, low: price, close: price, volume: 100, timestamp: Date.now() }
      const sig = strategy.onBar(
        { bar, bars: [], timestamp: bar.timestamp },
        { state, market: {}, orders: {}, position: {}, portfolio: {}, time: {}, indicators: {} } as any,
      )
      if (sig) signals.push(sig)
    }

    expect(signals.length).toBeGreaterThanOrEqual(1)
    expect(signals[0].direction).toBe('buy')
    expect(signals[0].confidence).toBeGreaterThan(0)
  })

  it('generates close signal on cross down (downtrend)', () => {
    const state = strategy.create({ state: {} } as any, { fastPeriod: 3, slowPeriod: 5 })

    const prices = [
      100, 100, 100, 100, 100,
      101, 102, 103, 104, 105,
      104, 103, 102, 101, 100,
    ]

    let signals: StrategySignal[] = []
    for (const price of prices) {
      const bar: StrategyBar = { open: price, high: price, low: price, close: price, volume: 100, timestamp: Date.now() }
      const sig = strategy.onBar(
        { bar, bars: [], timestamp: bar.timestamp },
        { state, market: {}, orders: {}, position: {}, portfolio: {}, time: {}, indicators: {} } as any,
      )
      if (sig) signals.push(sig)
    }

    const buySignal = signals.find(s => s.direction === 'buy')
    const closeSignal = signals.find(s => s.direction === 'close')
    expect(buySignal).not.toBeNull()
    expect(closeSignal).not.toBeNull()
  })

  it('does not flip on every tick when MA stays above', () => {
    const state = strategy.create({ state: {} } as any, { fastPeriod: 3, slowPeriod: 5 })

    // Strong uptrend — fast stays above slow
    const prices = [100, 100, 100, 100, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110]

    let signals: StrategySignal[] = []
    for (const price of prices) {
      const bar: StrategyBar = { open: price, high: price, low: price, close: price, volume: 100, timestamp: Date.now() }
      const sig = strategy.onBar(
        { bar, bars: [], timestamp: bar.timestamp },
        { state, market: {}, orders: {}, position: {}, portfolio: {}, time: {}, indicators: {} } as any,
      )
      if (sig) signals.push(sig)
    }

    // Only the first cross should generate a signal
    expect(signals.length).toBe(1)
    expect(signals[0].direction).toBe('buy')
  })
})
