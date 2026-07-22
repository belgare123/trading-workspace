// ── Exit Engine: unit tests ──
// Sprint 5.5

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ROIPolicy } from '../ROIPolicy'
import { StopLossPolicy } from '../StopLossPolicy'
import { TrailingPolicy } from '../TrailingPolicy'
import { EmergencyPolicy } from '../EmergencyPolicy'
import { PolicyChain } from '../PolicyChain'
import { ExitEngine } from '../ExitEngine'
import { ExitReason, Direction } from '../../trade'
import { computePnLPct, POLICY_PRIORITY } from '../types'
import type { TradeContext } from '../../trade'

// ── Helpers ──

function makeTrade(opts?: Partial<TradeContext['trade']>): TradeContext['trade'] {
  return {
    id: 'trade-1',
    strategyId: 'sma-cross',
    symbol: 'BTCUSDT',
    direction: Direction.Long,
    status: 'open',
    entry: { price: 100_000, quantity: 1, quoteQuantity: 100_000, timestamp: Date.now() - 60_000, orderId: 'o1' },
    exits: [],
    orderIds: ['o1'],
    fees: [],
    realizedPnL: 0,
    unrealizedPnL: 0,
    metadata: {},
    timestamps: { openedAt: Date.now() - 60_000, enteredAt: Date.now() - 60_000 },
    ...opts,
  } as any
}

function makeContext(overrides?: Partial<TradeContext>): TradeContext {
  return {
    trade: makeTrade(),
    market: { symbol: 'BTCUSDT', price: 101_000, bid: 100_990, ask: 101_010, spread: 20, timestamp: Date.now() },
    wallet: { total: 10_000, free: 5_000, reserved: 5_000, margin: 0, leverage: 1, exposure: 0.5, currency: 'USDT' },
    risk: { dailyLoss: 0, dailyLossLimit: -500, drawdown: 0, drawdownLimit: -0.15, openPositions: 1, maxOpenPositions: 5, isKillSwitchActive: false },
    history: { trades: [], totalTrades: 0, winRate: 0, totalPnL: 0 },
    strategy: { id: 'sma-cross', name: 'SMA Cross' },
    ...overrides,
  }
}

// ════════════════════════════════════════
// computePnLPct
// ════════════════════════════════════════

describe('computePnLPct', () => {
  it('returns positive for long above entry', () => {
    const t = makeTrade({ direction: Direction.Long, entry: { price: 100, quantity: 1, quoteQuantity: 100, timestamp: 0, orderId: 'o1' } })
    expect(computePnLPct(t, 110)).toBeCloseTo(0.1)
  })
  it('returns negative for long below entry', () => {
    const t = makeTrade({ direction: Direction.Long, entry: { price: 100, quantity: 1, quoteQuantity: 100, timestamp: 0, orderId: 'o1' } })
    expect(computePnLPct(t, 90)).toBeCloseTo(-0.1)
  })
  it('returns positive for short below entry', () => {
    const t = makeTrade({ direction: Direction.Short, entry: { price: 100, quantity: 1, quoteQuantity: 100, timestamp: 0, orderId: 'o1' } })
    expect(computePnLPct(t, 90)).toBeCloseTo(0.1)
  })
  it('returns 0 when no entry', () => {
    const t = makeTrade({ entry: null } as any)
    expect(computePnLPct(t, 100)).toBe(0)
  })
})

// ════════════════════════════════════════
// ROIPolicy
// ════════════════════════════════════════

describe('ROIPolicy', () => {
  it('returns exit when PnL% >= first threshold (1%)', () => {
    const p = new ROIPolicy({ thresholds: [{ pct: 0.01, amount: 'all' }] })
    // price=101k, entry=100k → 1%
    const d = p.evaluate(makeContext())
    expect(d).not.toBeNull()
    expect(d!.reason).toBe(ExitReason.TakeProfit)
    expect(d!.quantity).toBe('all')
  })

  it('returns null when PnL% below threshold', () => {
    const p = new ROIPolicy({ thresholds: [{ pct: 0.05, amount: 'all' }] })
    // price=101k, entry=100k → 1% < 5%
    expect(p.evaluate(makeContext())).toBeNull()
  })

  it('exits at highest met threshold (greedy)', () => {
    const p = new ROIPolicy({ thresholds: [{ pct: 0.01, amount: 0.5 }, { pct: 0.02, amount: 1.0 }] })
    const ctx = makeContext({ market: { ...makeContext().market, price: 103_000 } })
    // PnL = 3%, should hit 2% threshold
    const d = p.evaluate(ctx)
    expect(d).not.toBeNull()
    expect(d!.quantity).toBe(1.0)
  })

  it('throws with empty thresholds', () => {
    expect(() => new ROIPolicy({ thresholds: [] })).toThrow()
  })

  it('handles short trades (profit when price drops)', () => {
    const p = new ROIPolicy({ thresholds: [{ pct: 0.01, amount: 'all' }] })
    const ctx = makeContext({
      trade: makeTrade({ direction: Direction.Short }),
      market: { ...makeContext().market, price: 99_000 }, // entry=100k, now=99k → +1%
    })
    expect(p.evaluate(ctx)).not.toBeNull()
  })
})

// ════════════════════════════════════════
// StopLossPolicy
// ════════════════════════════════════════

describe('StopLossPolicy', () => {
  it('exits on fixed -1%', () => {
    const p = new StopLossPolicy({ mode: 'fixed', value: -0.01 })
    const ctx = makeContext({ market: { ...makeContext().market, price: 98_900 } }) // -1.1%
    const d = p.evaluate(ctx)
    expect(d).not.toBeNull()
    expect(d!.reason).toBe(ExitReason.StopLoss)
  })

  it('returns null above threshold', () => {
    const p = new StopLossPolicy({ mode: 'fixed', value: -0.02 })
    // price=101k → +1%, no stop
    expect(p.evaluate(makeContext())).toBeNull()
  })

  it('exits at price level (long)', () => {
    const p = new StopLossPolicy({ mode: 'price-level', value: -0.02, priceLevel: 99_000 })
    const ctx = makeContext({ market: { ...makeContext().market, price: 98_500 } })
    const d = p.evaluate(ctx)
    expect(d).not.toBeNull()
    expect(d!.reason).toBe(ExitReason.StopLoss)
  })

  it('does not exit above price level', () => {
    const p = new StopLossPolicy({ mode: 'price-level', value: -0.02, priceLevel: 99_000 })
    expect(p.evaluate(makeContext())).toBeNull()
  })

  it('does not exit on short above price level', () => {
    const p = new StopLossPolicy({ mode: 'price-level', value: -0.02, priceLevel: 101_000 })
    const ctx = makeContext({ trade: makeTrade({ direction: Direction.Short }), market: { ...makeContext().market, price: 100_500 } })
    expect(p.evaluate(ctx)).toBeNull()
  })

  it('exits on short at price level', () => {
    const p = new StopLossPolicy({ mode: 'price-level', value: -0.02, priceLevel: 101_000 })
    const ctx = makeContext({ trade: makeTrade({ direction: Direction.Short }), market: { ...makeContext().market, price: 101_500 } })
    const d = p.evaluate(ctx)
    expect(d).not.toBeNull()
    expect(d!.reason).toBe(ExitReason.StopLoss)
  })

  it('throws if value >= 0', () => {
    expect(() => new StopLossPolicy({ mode: 'fixed', value: 0 })).toThrow()
  })

  it('returns null for trailing mode (delegated to TrailingPolicy)', () => {
    const p = new StopLossPolicy({ mode: 'trailing', value: -0.01 })
    expect(p.evaluate(makeContext())).toBeNull()
  })
})

// ════════════════════════════════════════
// TrailingPolicy
// ════════════════════════════════════════

describe('TrailingPolicy', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null below activation', () => {
    const p = new TrailingPolicy({ activationPct: 0.02, distancePct: 0.005, stepPct: 0.001, offsetPct: 0.001 })
    // PnL = 1% < 2% activation
    expect(p.evaluate(makeContext())).toBeNull()
  })

  it('does not exit while price rises (trailing active but not triggered)', () => {
    const p = new TrailingPolicy({ activationPct: 0.01, distancePct: 0.005, stepPct: 0.001, offsetPct: 0.001 })
    // PnL = 1%, activation = 1%, so trailing is active
    // But price=101k, peak=101k, distance=0.5% so stop at 100,495 > 101k — no exit
    expect(p.evaluate(makeContext())).toBeNull()
  })

  it('exits when price drops below trailing distance', () => {
    const p = new TrailingPolicy({ activationPct: 0.01, distancePct: 0.005, stepPct: 0.001, offsetPct: 0.001 })
    // 1st tick: price=102k, activation+peak=2%
    p.evaluate(makeContext({ market: { ...makeContext().market, price: 102_000 } }))
    // 2nd tick: price drops to 101k → PnL=1%, peak=2%, distance=0.5% → stop at 101,500
    // 1% < 1.5% → exit
    const d = p.evaluate(makeContext({ market: { ...makeContext().market, price: 101_000 } }))
    expect(d).not.toBeNull()
    expect(d!.reason).toBe(ExitReason.TrailingStop)
  })

  it('tracks per-trade peaks separately', () => {
    const p = new TrailingPolicy({ activationPct: 0.01, distancePct: 0.01, stepPct: 0.001, offsetPct: 0.001 })
    const ctx1 = makeContext({ trade: makeTrade({ id: 't1' }) })
    const ctx2 = makeContext({ trade: makeTrade({ id: 't2' }) })
    p.evaluate({ ...ctx1, market: { ...ctx1.market, price: 105_000 } })
    p.evaluate({ ...ctx2, market: { ...ctx2.market, price: 102_000 } })
    expect(p.getPeak('t1')).toBeCloseTo(0.05)
    expect(p.getPeak('t2')).toBeCloseTo(0.02)
    // Drop t1 below stop
    const d = p.evaluate({ ...ctx1, market: { ...ctx1.market, price: 103_000 } })
    expect(d).not.toBeNull()
  })

  it('resets peak when falling below activation', () => {
    const p = new TrailingPolicy({ activationPct: 0.02, distancePct: 0.005, stepPct: 0.001, offsetPct: 0.001 })
    const ctx = makeContext({ market: { ...makeContext().market, price: 105_000 } })
    p.evaluate(ctx) // 5% → peak=5%
    expect(p.getPeak('trade-1')).toBeCloseTo(0.05)
    // Drop to 99k → -1% < activation
    const ctx2 = makeContext({ market: { ...makeContext().market, price: 99_000 } })
    p.evaluate(ctx2)
    // Peak should be cleared (fell below activation)
    expect(p.getPeak('trade-1')).toBeUndefined()
  })
})

// ════════════════════════════════════════
// EmergencyPolicy
// ════════════════════════════════════════

describe('EmergencyPolicy', () => {
  it('exits on kill switch', () => {
    const p = new EmergencyPolicy()
    const ctx = makeContext({ risk: { ...makeContext().risk, isKillSwitchActive: true } })
    const d = p.evaluate(ctx)
    expect(d).not.toBeNull()
    expect(d!.reason).toBe(ExitReason.EmergencyExit)
  })

  it('exits on max drawdown', () => {
    const p = new EmergencyPolicy({ maxDrawdownPct: -0.1 })
    const ctx = makeContext({ risk: { ...makeContext().risk, drawdown: -0.12 } })
    const d = p.evaluate(ctx)
    expect(d).not.toBeNull()
    expect(d!.reason).toBe(ExitReason.EmergencyExit)
  })

  it('exits on max trade age', () => {
    const p = new EmergencyPolicy({ maxTradeAgeMs: 100 })
    // trade was opened 60s ago > 100ms → time exit
    const d = p.evaluate(makeContext())
    expect(d).not.toBeNull()
    expect(d!.reason).toBe(ExitReason.TimeExit)
  })

  it('returns null when all conditions pass', () => {
    const p = new EmergencyPolicy({ maxDrawdownPct: -0.2, maxTradeAgeMs: 86_400_000 })
    expect(p.evaluate(makeContext())).toBeNull()
  })
})

// ════════════════════════════════════════
// PolicyChain
// ════════════════════════════════════════

describe('PolicyChain', () => {
  it('returns first non-null decision (emergency wins)', () => {
    const emergency = new EmergencyPolicy({ maxDrawdownPct: -0.01 }) // will fire
    const roi = new ROIPolicy({ thresholds: [{ pct: 0.01, amount: 'all' }] })
    const chain = new PolicyChain([emergency, roi])
    const ctx = makeContext({ risk: { ...makeContext().risk, drawdown: -0.05 } })
    const d = chain.evaluate(ctx)
    expect(d).not.toBeNull()
    expect(d!.reason).toBe(ExitReason.EmergencyExit)
  })

  it('falls through to next policy when first returns null', () => {
    const emergency = new EmergencyPolicy({ maxDrawdownPct: -0.2 })
    const roi = new ROIPolicy({ thresholds: [{ pct: 0.01, amount: 'all' }] })
    const chain = new PolicyChain([emergency, roi])
    const d = chain.evaluate(makeContext())
    expect(d).not.toBeNull()
    expect(d!.reason).toBe(ExitReason.TakeProfit)
  })

  it('throws with empty chain', () => {
    expect(() => new PolicyChain([])).toThrow()
  })

  it('add() appends policy', () => {
    const chain = new PolicyChain([new EmergencyPolicy()])
    chain.add(new ROIPolicy({ thresholds: [{ pct: 0.01, amount: 'all' }] }))
    expect(chain.list().length).toBe(2)
  })

  it('remove() deletes by id', () => {
    const chain = new PolicyChain([new EmergencyPolicy(), new ROIPolicy({ thresholds: [{ pct: 0.01, amount: 'all' }] })])
    chain.remove('roi')
    expect(chain.list().length).toBe(1)
    expect(chain.list()[0].id).toBe('emergency')
  })
})

// ════════════════════════════════════════
// ExitEngine (integration)
// ════════════════════════════════════════

describe('ExitEngine', () => {
  it('creates with no config (default fallback)', () => {
    const ee = new ExitEngine()
    expect(ee.policies.emergency).toBeDefined()
  })

  it('creates with full config', () => {
    const ee = new ExitEngine({
      roi: { thresholds: [{ pct: 0.01, amount: 'all' }] },
      stopLoss: { mode: 'fixed', value: -0.02 },
      trailing: { activationPct: 0.02, distancePct: 0.01, stepPct: 0.001, offsetPct: 0.001 },
      emergency: { maxDrawdownPct: -0.15, maxTradeAgeMs: 86_400_000, respectKillSwitch: true },
    })
    expect(ee.policies.roi).toBeDefined()
    expect(ee.policies.stopLoss).toBeDefined()
    expect(ee.policies.trailing).toBeDefined()
    expect(ee.policies.emergency).toBeDefined()
    expect(ee.chain.list().length).toBe(4)
  })

  it('returns take-profit when profitable', () => {
    const ee = new ExitEngine({ roi: { thresholds: [{ pct: 0.01, amount: 'all' }] } })
    const d = ee.evaluate(makeContext()) // +1%
    expect(d).not.toBeNull()
    expect(d!.reason).toBe(ExitReason.TakeProfit)
  })

  it('returns stop-loss when losing', () => {
    const ee = new ExitEngine({ stopLoss: { mode: 'fixed', value: -0.01 } })
    const ctx = makeContext({ market: { ...makeContext().market, price: 98_900 } })
    const d = ee.evaluate(ctx)
    expect(d).not.toBeNull()
    expect(d!.reason).toBe(ExitReason.StopLoss)
  })

  it('emergency overrides take-profit (chain order)', () => {
    const ee = new ExitEngine({
      roi: { thresholds: [{ pct: 0.01, amount: 'all' }] },
      emergency: { maxDrawdownPct: -0.01, maxTradeAgeMs: 86_400_000, respectKillSwitch: true },
    })
    const ctx = makeContext({ risk: { ...makeContext().risk, drawdown: -0.05 } })
    const d = ee.evaluate(ctx) // +1% ROI would fire, but emergency is checked first
    expect(d).not.toBeNull()
    expect(d!.reason).toBe(ExitReason.EmergencyExit)
  })
})
