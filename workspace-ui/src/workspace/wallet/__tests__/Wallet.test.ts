// ── Wallet: unit tests ──
// Sprint 5.6 — WalletManager

import { describe, it, expect, vi } from 'vitest'
import { Wallet } from '../Wallet'
import { FixedAmountAllocator } from '../allocation/FixedAmountAllocator'
import { FixedPercentAllocator } from '../allocation/FixedPercentAllocator'
import { RiskPercentAllocator } from '../allocation/RiskPercentAllocator'
import { KellyAllocator } from '../allocation/KellyAllocator'
import { WalletEventBus } from '../events/WalletEventBus'
import { WalletManager } from '../runtime/WalletManager'
import { WalletSynchronizer } from '../runtime/WalletSynchronizer'
import type { Balance, AllocationRequest } from '../types'
import type { Trade } from '../../trade/Trade'
import { Direction } from '../../trade/types'

// ════════════════════════════════════════
// Wallet domain model
// ════════════════════════════════════════

describe('Wallet', () => {
  it('creates with default zero balance', () => {
    const w = new Wallet()
    expect(w.balance.total).toBe(0)
    expect(w.balance.free).toBe(0)
    expect(w.balance.locked).toBe(0)
    expect(w.balance.currency).toBe('USDT')
  })

  it('creates with initial balance', () => {
    const w = new Wallet({ total: 10_000, free: 10_000 })
    expect(w.balance.total).toBe(10_000)
    expect(w.balance.free).toBe(10_000)
  })

  it('reserve subtracts from free, adds to locked', () => {
    const w = new Wallet({ total: 10_000, free: 10_000 })
    w.reserve(500, 'order-1')
    expect(w.balance.free).toBe(9_500)
    expect(w.balance.locked).toBe(500)
  })

  it('reserve throws on insufficient balance', () => {
    const w = new Wallet({ total: 100, free: 100 })
    expect(() => w.reserve(200, 'order-1')).toThrow('Insufficient')
  })

  it('release returns funds from locked to free', () => {
    const w = new Wallet({ total: 10_000, free: 10_000 })
    w.reserve(500, 'order-1')
    w.release('order-1')
    expect(w.balance.free).toBe(10_000)
    expect(w.balance.locked).toBe(0)
  })

  it('release unknown orderId is no-op', () => {
    const w = new Wallet({ total: 10_000, free: 10_000 })
    w.release('nonexistent')
    expect(w.balance.free).toBe(10_000)
  })

  it('commit adds realized PnL', () => {
    const w = new Wallet({ total: 10_000, free: 10_000 })
    const trade = { id: 't-1', realizedPnL: 150 } as Trade
    w.commit(trade)
    expect(w.balance.realizedPnL).toBe(150)
    expect(w.balance.total).toBe(10_150)
    expect(w.balance.free).toBe(10_150)
  })

  it('sync replaces balance and emits equity change', () => {
    const w = new Wallet({ total: 10_000, free: 10_000 })
    const handler = vi.fn()
    w.on('wallet:equity-changed', handler)
    w.sync({ total: 12_000, free: 11_500, locked: 500, marginUsed: 0, unrealizedPnL: 0, realizedPnL: 200, currency: 'USDT', timestamp: Date.now() })
    expect(w.balance.total).toBe(12_000)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('getSnapshot returns immutable projection', () => {
    const w = new Wallet({ total: 10_000, free: 8_000, locked: 2_000 })
    const snap = w.getSnapshot()
    expect(snap.total).toBe(10_000)
    expect(snap.locked).toBe(2_000)
  })

  it('shutdown removes all handlers', () => {
    const w = new Wallet({ total: 100, free: 100 })
    const handler = vi.fn()
    w.on('wallet:reserved', handler)
    w.shutdown()
    w.reserve(100, 'o1') // should not fire handler
    expect(handler).not.toHaveBeenCalled()
  })

  it('unsubscribe cleans up handler set', () => {
    const w = new Wallet({ total: 100, free: 100 })
    const handler = vi.fn()
    const unsub = w.on('wallet:reserved', handler)
    unsub()
    w.reserve(100, 'o1')
    expect(handler).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════
// FixedAmountAllocator
// ════════════════════════════════════════

describe('FixedAmountAllocator', () => {
  const balance: Balance = { total: 10_000, free: 10_000, locked: 0, marginUsed: 0, unrealizedPnL: 0, realizedPnL: 0, currency: 'USDT', timestamp: 0 }

  it('returns fixed quantity', () => {
    const a = new FixedAmountAllocator({ amount: 10 })
    const req: AllocationRequest = { strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long, price: 100 }
    const r = a.allocate(req, balance)
    expect(r.quantity).toBe(10)
    expect(r.notionalValue).toBe(1_000)
    expect(r.method).toBe('fixed-10')
  })

  it('throws on zero or negative amount', () => {
    expect(() => new FixedAmountAllocator({ amount: 0 })).toThrow()
    expect(() => new FixedAmountAllocator({ amount: -1 })).toThrow()
  })
})

// ════════════════════════════════════════
// FixedPercentAllocator
// ════════════════════════════════════════

describe('FixedPercentAllocator', () => {
  const balance: Balance = { total: 10_000, free: 10_000, locked: 0, marginUsed: 0, unrealizedPnL: 0, realizedPnL: 0, currency: 'USDT', timestamp: 0 }

  it('allocates 2% of equity', () => {
    const a = new FixedPercentAllocator({ percent: 0.02 })
    const req: AllocationRequest = { strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long, price: 100 }
    const r = a.allocate(req, balance)
    expect(r.quantity).toBe(2) // 200/100
    expect(r.notionalValue).toBe(200)
    expect(r.pctOfEquity).toBe(0.02)
  })

  it('throws on invalid percent', () => {
    expect(() => new FixedPercentAllocator({ percent: 0 })).toThrow()
    expect(() => new FixedPercentAllocator({ percent: 1.5 })).toThrow()
  })

  it('applies max leverage', () => {
    const a = new FixedPercentAllocator({ percent: 0.02, maxLeverage: 3 })
    const req: AllocationRequest = { strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long, price: 100 }
    const r = a.allocate(req, balance)
    expect(r.quantity).toBe(6) // 10,000 * 0.02 * 3 / 100
    expect(r.notionalValue).toBe(600)
  })
})

// ════════════════════════════════════════
// RiskPercentAllocator
// ════════════════════════════════════════

describe('RiskPercentAllocator', () => {
  const balance: Balance = { total: 10_000, free: 10_000, locked: 0, marginUsed: 0, unrealizedPnL: 0, realizedPnL: 0, currency: 'USDT', timestamp: 0 }

  it('sizes position based on risk (stop loss distance)', () => {
    const a = new RiskPercentAllocator({ riskPercent: 0.01 }) // 1% of 10k = 100 risk
    const req: AllocationRequest = {
      strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long,
      price: 50_000, stopLoss: 49_000,
    }
    const r = a.allocate(req, balance)
    // riskCapital = 100, priceRisk = 1000
    // quantity = 100 / 1000 = 0.1
    expect(r.quantity).toBe(0.1)
    expect(r.riskAmount).toBe(100)
    expect(r.riskPct).toBe(0.01)
    expect(r.method).toBe('risk-percent')
  })

  it('falls back to fixed% when no stopLoss', () => {
    const a = new RiskPercentAllocator({ riskPercent: 0.01 })
    const req: AllocationRequest = {
      strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long,
      price: 50_000,
    }
    const r = a.allocate(req, balance)
    // riskCapital = 100, no stopLoss => quantity = 100/50000 = 0.002
    expect(r.quantity).toBe(0.002)
    expect(r.method).toBe('risk-percent-fallback')
  })

  it('throws when stopLoss equals entry price', () => {
    const a = new RiskPercentAllocator({ riskPercent: 0.01 })
    expect(() => a.allocate({
      strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long,
      price: 50_000, stopLoss: 50_000,
    }, balance)).toThrow()
  })

  it('throws on invalid riskPercent', () => {
    expect(() => new RiskPercentAllocator({ riskPercent: 0 })).toThrow()
    expect(() => new RiskPercentAllocator({ riskPercent: 1.5 })).toThrow()
  })
})

// ════════════════════════════════════════
// KellyAllocator
// ════════════════════════════════════════

describe('KellyAllocator', () => {
  const balance: Balance = { total: 10_000, free: 10_000, locked: 0, marginUsed: 0, unrealizedPnL: 0, realizedPnL: 0, currency: 'USDT', timestamp: 0 }

  it('calculates position using Kelly formula', () => {
    // winRate=0.6, avgRiskReward=1.5
    // f = (0.6*1.5 - 0.4) / 1.5 = (0.9-0.4)/1.5 = 0.333
    // clamped to 0.25, fraction=0.25 => final=0.0625
    const a = new KellyAllocator({ fraction: 0.25, winRate: 0.6, avgRiskReward: 1.5 })
    const req: AllocationRequest = { strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long, price: 100 }
    const r = a.allocate(req, balance)
    // allocatedEquity = 10000 * 0.0625 = 625
    // quantity = 625/100 = 6.25
    expect(r.quantity).toBe(6.25)
    expect(r.pctOfEquity).toBeCloseTo(0.0625)
    expect(r.method).toBe('kelly')
  })

  it('returns 0 when kelly is negative', () => {
    const a = new KellyAllocator({ fraction: 0.25, winRate: 0.3, avgRiskReward: 1.0 })
    const req: AllocationRequest = { strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long, price: 100 }
    const r = a.allocate(req, balance)
    // f = (0.3-0.7)/1 = -0.4 → clamped to 0
    expect(r.quantity).toBe(0)
    expect(r.pctOfEquity).toBe(0)
  })
})

// ════════════════════════════════════════
// WalletEventBus
// ════════════════════════════════════════

describe('WalletEventBus', () => {
  it('emits and receives events', () => {
    const bus = new WalletEventBus()
    const handler = vi.fn()
    bus.on('wallet:balance-updated', handler)
    bus.emit({ type: 'wallet:balance-updated', balance: { total: 100 } as Balance, timestamp: 1 })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe removes handler', () => {
    const bus = new WalletEventBus()
    const handler = vi.fn()
    const unsub = bus.on('wallet:reserved', handler)
    unsub()
    bus.emit({ type: 'wallet:reserved', amount: 10, orderId: 'o1', timestamp: 1 })
    expect(handler).not.toHaveBeenCalled()
  })

  it('off removes handler', () => {
    const bus = new WalletEventBus()
    const handler = vi.fn()
    bus.on('wallet:reserved', handler)
    bus.off('wallet:reserved', handler)
    bus.emit({ type: 'wallet:reserved', amount: 10, orderId: 'o1', timestamp: 1 })
    expect(handler).not.toHaveBeenCalled()
  })

  it('clear removes all handlers', () => {
    const bus = new WalletEventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('wallet:allocated', h1)
    bus.on('wallet:committed', h2)
    bus.clear()
    bus.emit({ type: 'wallet:allocated', result: {} as any, timestamp: 1 })
    bus.emit({ type: 'wallet:committed', tradeId: 't1', realizedPnL: 10, timestamp: 1 })
    expect(h1).not.toHaveBeenCalled()
    expect(h2).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════
// WalletManager (integration)
// ════════════════════════════════════════

describe('WalletManager', () => {
  it('creates with initial balance', () => {
    const wm = new WalletManager({ initialBalance: { total: 10_000, free: 10_000 } })
    const b = wm.getBalance()
    expect(b.total).toBe(10_000)
  })

  it('allocate uses configured allocator', () => {
    const wm = new WalletManager({
      initialBalance: { total: 10_000, free: 10_000 },
      allocator: new FixedAmountAllocator({ amount: 5 }),
    })
    const r = wm.allocate({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long, price: 100 })
    expect(r.quantity).toBe(5)
  })

  it('throws when no allocator configured', () => {
    const wm = new WalletManager()
    expect(() => wm.allocate({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long, price: 100 })).toThrow('no allocator')
  })

  it('throws on insufficient equity', () => {
    const wm = new WalletManager({
      initialBalance: { total: 100, free: 100 },
      allocator: new FixedAmountAllocator({ amount: 10 }),
    })
    // 10 * 50_000 = 500_000 > 100
    expect(() => wm.allocate({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long, price: 50_000 })).toThrow('Insufficient equity')
  })

  it('reserve and release flow', () => {
    const wm = new WalletManager({ initialBalance: { total: 10_000, free: 10_000 } })
    wm.reserve(500, 'order-1')
    expect(wm.getBalance().free).toBe(9_500)
    wm.release('order-1')
    expect(wm.getBalance().free).toBe(10_000)
  })

  it('commit updates realized PnL', () => {
    const wm = new WalletManager({ initialBalance: { total: 10_000, free: 10_000 } })
    wm.commit({ id: 't-1', realizedPnL: 200 } as Trade)
    expect(wm.getBalance().realizedPnL).toBe(200)
  })

  it('sync replaces balance', () => {
    const wm = new WalletManager({ initialBalance: { total: 10_000, free: 10_000 } })
    wm.sync({ total: 15_000, free: 14_000, locked: 1_000, marginUsed: 0, unrealizedPnL: 500, realizedPnL: 0, currency: 'USDT', timestamp: Date.now() })
    expect(wm.getBalance().total).toBe(15_000)
  })

  it('getSnapshot returns correct shape', () => {
    const wm = new WalletManager({ initialBalance: { total: 10_000, free: 8_000, locked: 2_000 } })
    const snap = wm.getSnapshot()
    expect(snap.total).toBe(10_000)
    expect(snap.free).toBe(8_000)
    expect(snap.locked).toBe(2_000)
    expect(snap.openPositionCount).toBe(0)
  })

  it('events flow through WalletManager', () => {
    const wm = new WalletManager({ initialBalance: { total: 10_000, free: 10_000 } })
    const handler = vi.fn()
    wm.on('wallet:reserved', handler)
    wm.reserve(100, 'o1')
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

// ════════════════════════════════════════
// WalletSynchronizer
// ════════════════════════════════════════

describe('WalletSynchronizer', () => {
  it('syncOnce calls gateway and updates wallet', async () => {
    const wm = new WalletManager({ initialBalance: { total: 100, free: 100 } })
    const gateway = { getBalance: vi.fn().mockResolvedValue({ total: 200, free: 200, locked: 0, marginUsed: 0, unrealizedPnL: 0, realizedPnL: 0, currency: 'USDT', timestamp: Date.now() } as Balance) }
    const sync = new WalletSynchronizer(wm, gateway, { pollIntervalMs: 999_999, maxRetries: 1 })
    const ok = await sync.syncOnce()
    expect(ok).toBe(true)
    expect(wm.getBalance().total).toBe(200)
    expect(gateway.getBalance).toHaveBeenCalledTimes(1)
  })

  it('syncOnce handles gateway error and returns false', async () => {
    const wm = new WalletManager({ initialBalance: { total: 100, free: 100 } })
    const gateway = { getBalance: vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ total: 200, free: 200, locked: 0, marginUsed: 0, unrealizedPnL: 0, realizedPnL: 0, currency: 'USDT', timestamp: Date.now() } as Balance) }
    const sync = new WalletSynchronizer(wm, gateway, { pollIntervalMs: 999_999, maxRetries: 2 })
    const ok = await sync.syncOnce()
    expect(ok).toBe(false)
    // Second call succeeds
    const ok2 = await sync.syncOnce()
    expect(ok2).toBe(true)
    expect(wm.getBalance().total).toBe(200)
  })

  it('stop and isRunning', () => {
    const wm = new WalletManager()
    const gateway = { getBalance: vi.fn().mockResolvedValue({ total: 100, free: 100, locked: 0, marginUsed: 0, unrealizedPnL: 0, realizedPnL: 0, currency: 'USDT', timestamp: 0 } as Balance) }
    const sync = new WalletSynchronizer(wm, gateway, { pollIntervalMs: 999_999, maxRetries: 1 })
    expect(sync.isRunning).toBe(false)
    sync.start()
    expect(sync.isRunning).toBe(true)
    sync.stop()
    expect(sync.isRunning).toBe(false)
  })
})
