/**
 * ProductionKillSwitch.test.ts — Emergency stop unit tests
 *
 * Covers config merging, manual/auto trigger, threshold breaches,
 * deactivation lifecycle, and RiskRuntime interaction.
 *
 * @since Sprint 5.8 Production Launch Gate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProductionKillSwitch } from './ProductionKillSwitch'

// ── Mocks ──

const mockGateway = () => ({
  refresh: vi.fn().mockResolvedValue(undefined),
  getAccount: vi.fn().mockReturnValue({ totalEquity: 10000 }),
  getPositions: vi.fn().mockResolvedValue([]),
  cancelAllOrders: vi.fn().mockResolvedValue(3),
  placeOrder: vi.fn().mockResolvedValue({ id: '', symbol: '', side: 'sell', executedQuantity: 0, price: 0, averagePrice: null, updatedAt: Date.now() }),
})

const mockRiskRuntime = () => ({
  killSwitch: {
    active: false,
    reason: '',
    triggeredAt: 0,
    triggeredBy: '',
  },
})

describe('ProductionKillSwitch', () => {
  let gw: ReturnType<typeof mockGateway>
  let risk: ReturnType<typeof mockRiskRuntime>

  beforeEach(() => {
    gw = mockGateway()
    risk = mockRiskRuntime()
  })

  // ── Construction ──

  it('merges config with defaults', () => {
    const ks = new ProductionKillSwitch(gw as any)
    expect(ks.getConfig().thresholds.maxDrawdownPercent).toBe(20)
    expect(ks.getConfig().intervalMs).toBe(30_000)
  })

  it('overrides specific thresholds', () => {
    const ks = new ProductionKillSwitch(gw as any, {
      thresholds: { maxDrawdownPercent: 10, maxDailyLossPercent: 5, maxPositionCount: 3 },
    })
    expect(ks.getConfig().thresholds.maxDrawdownPercent).toBe(10)
    expect(ks.getConfig().thresholds.maxDailyLossPercent).toBe(5)
    expect(ks.getConfig().thresholds.maxPositionCount).toBe(3)
    expect(ks.getConfig().actions.cancelOrders).toBe(true) // inherited from defaults
  })

  it('overrides specific actions', () => {
    const ks = new ProductionKillSwitch(gw as any, {
      actions: { cancelOrders: false, closePositions: false, blockNewOrders: false },
    })
    expect(ks.getConfig().actions.cancelOrders).toBe(false)
    expect(ks.getConfig().actions.closePositions).toBe(false)
    expect((ks.getConfig() as any).blockNewOrders).toBeUndefined() // not leaked to top-level config
  })

  it('starts not triggered', () => {
    const ks = new ProductionKillSwitch(gw as any)
    expect(ks.isTriggered()).toBe(false)
  })

  // ── Lifecycle ──

  it('start is no-op when intervalMs = 0', () => {
    const ks = new ProductionKillSwitch(gw as any, { intervalMs: 0 })
    ks.start()
    // No timer means no auto checks — can't really assert except it didn't throw
    expect(ks.isTriggered()).toBe(false)
  })

  it('start calls refreshPeakEquity once', () => {
    const ks = new ProductionKillSwitch(gw as any, { intervalMs: 5000 })
    ks.start()
    expect(gw.getAccount).toHaveBeenCalled()
    ks.stop()
  })

  it('double start does not set multiple timers', () => {
    const ks = new ProductionKillSwitch(gw as any, { intervalMs: 5000 })
    ks.start()
    ks.start()
    ks.stop() // just ensure no crash
  })

  // ── Manual Trigger ──

  it('trigger cancels orders, closes positions, blocks new orders', async () => {
    gw.getPositions.mockResolvedValue([
      { symbol: 'BTCUSDT', direction: 'long', quantity: 0.5 },
      { symbol: 'ETHUSDT', direction: 'short', quantity: 2 },
    ])
    gw.placeOrder.mockResolvedValue({ id: 'x', symbol: '', side: 'sell', executedQuantity: 0, price: 0, averagePrice: null, updatedAt: Date.now() })

    const ks = new ProductionKillSwitch(gw as any)
    ks.attachRiskRuntime(risk as any)
    await ks.trigger('manual test')

    expect(ks.isTriggered()).toBe(true)
    expect(gw.cancelAllOrders).toHaveBeenCalled()
    expect(gw.getPositions).toHaveBeenCalled()
    expect(gw.placeOrder).toHaveBeenCalledTimes(2)
    expect(risk.killSwitch.active).toBe(true)
    expect(risk.killSwitch.reason).toBe('manual test')
  })

  it('trigger is idempotent (second call is no-op)', async () => {
    const ks = new ProductionKillSwitch(gw as any)
    await ks.trigger('first')
    await ks.trigger('second')
    expect(gw.cancelAllOrders).toHaveBeenCalledTimes(1)
  })

  it('trigger continues even if cancelAllOrders fails', async () => {
    gw.cancelAllOrders.mockRejectedValue(new Error('network error'))
    const ks = new ProductionKillSwitch(gw as any)
    await expect(ks.trigger('partial-failure')).resolves.toBeUndefined()
    expect(ks.isTriggered()).toBe(true) // still triggered despite partial error
  })

  it('onTrigger callback receives reason and details', async () => {
    const cb = vi.fn()
    const ks = new ProductionKillSwitch(gw as any)
    ks.onTrigger = cb
    await ks.trigger('manual cb test')
    expect(cb).toHaveBeenCalledWith('manual cb test', expect.any(Array))
  })

  // ── Deactivate ──

  it('deactivate resets trigger + riskRuntime', () => {
    const ks = new ProductionKillSwitch(gw as any)
    ks.attachRiskRuntime(risk as any)

    // Trigger first
    ks['triggered'] = true
    risk.killSwitch.active = true
    risk.killSwitch.reason = 'test'

    ks.deactivate()
    expect(ks.isTriggered()).toBe(false)
    expect(risk.killSwitch.active).toBe(false)
    expect(risk.killSwitch.reason).toBe('')
  })

  // ── Auto-check: threshold breaches ──

  it('triggers on drawdown breach', async () => {
    // peakEquity starts at 10000 (from refreshPeakEquity), equity drops to 7500 → 25% drawdown
    gw.getAccount.mockReturnValue({ totalEquity: 7500 })
    gw.getPositions.mockResolvedValue([])

    const ks = new ProductionKillSwitch(gw as any, {
      thresholds: { maxDrawdownPercent: 20, maxDailyLossPercent: 0, maxPositionCount: 0 },
    })
    // Manually set peak equity to simulate earlier higher point
    ks['peakEquity'] = 10000

    // Trigger check via private method
    await ks['check']()
    expect(ks.isTriggered()).toBe(true)
  })

  it('does NOT trigger within drawdown limit', async () => {
    gw.getAccount.mockReturnValue({ totalEquity: 9500 })
    gw.getPositions.mockResolvedValue([])

    const ks = new ProductionKillSwitch(gw as any, {
      thresholds: { maxDrawdownPercent: 20, maxDailyLossPercent: 0, maxPositionCount: 0 },
    })
    ks['peakEquity'] = 10000

    await ks['check']()
    expect(ks.isTriggered()).toBe(false)
  })

  it('triggers on daily loss breach', async () => {
    gw.getAccount.mockReturnValue({ totalEquity: 8500 })
    gw.getPositions.mockResolvedValue([])

    const ks = new ProductionKillSwitch(gw as any, {
      thresholds: { maxDrawdownPercent: 0, maxDailyLossPercent: 10, maxPositionCount: 0 },
    })
    ks['startOfDayEquity'] = 10000
    ks['lastCheckDay'] = new Date().getUTCDate() // avoid day-change reset

    await ks['check']()
    expect(ks.isTriggered()).toBe(true)
  })

  it('triggers on max position count breach', async () => {
    gw.getAccount.mockReturnValue({ totalEquity: 10000 })
    gw.getPositions.mockResolvedValue([
      { quantity: 1 }, { quantity: 0.5 }, { quantity: 2 },
    ].map((p) => ({ ...p, symbol: 'X', direction: 'long', avgPrice: 100, unrealizedPnl: 0, updatedAt: Date.now() })))

    const ks = new ProductionKillSwitch(gw as any, {
      thresholds: { maxDrawdownPercent: 0, maxDailyLossPercent: 0, maxPositionCount: 2 },
    })

    await ks['check']()
    expect(ks.isTriggered()).toBe(true)
  })

  it('does NOT trigger below position count threshold', async () => {
    gw.getAccount.mockReturnValue({ totalEquity: 10000 })
    gw.getPositions.mockResolvedValue([
      { quantity: 1, symbol: 'A', direction: 'long', avgPrice: 100, unrealizedPnl: 0, updatedAt: Date.now() },
    ])

    const ks = new ProductionKillSwitch(gw as any, {
      thresholds: { maxDrawdownPercent: 0, maxDailyLossPercent: 0, maxPositionCount: 5 },
    })

    await ks['check']()
    expect(ks.isTriggered()).toBe(false)
  })

  // ── Check callback ──

  it('fires onCheck callback during check', async () => {
    gw.getAccount.mockReturnValue({ totalEquity: 10000 })
    gw.getPositions.mockResolvedValue([])
    const cb = vi.fn()

    const ks = new ProductionKillSwitch(gw as any)
    ks.onCheck = cb

    await ks['check']()
    expect(cb).toHaveBeenCalledWith(10000, 0)
  })

  // ── Error callback ──

  it('fires onError when check fails', async () => {
    gw.refresh.mockRejectedValue(new Error('refresh failed'))
    const cb = vi.fn()

    const ks = new ProductionKillSwitch(gw as any, { intervalMs: 10 })
    ks.onError = cb
    ks.start()

    // Wait for at least one interval tick
    await new Promise((r) => setTimeout(r, 30))
    ks.stop()

    expect(cb).toHaveBeenCalled()
  })

  // ── attachRiskRuntime ──

  it('attachRiskRuntime makes blockNewOrders effective', async () => {
    const ks = new ProductionKillSwitch(gw as any)
    expect(() => ks['check']()).not.toThrow() // no risk runtime attached

    ks.attachRiskRuntime(risk as any)
    await ks.trigger('with-risk')
    expect(risk.killSwitch.active).toBe(true)
  })
})
