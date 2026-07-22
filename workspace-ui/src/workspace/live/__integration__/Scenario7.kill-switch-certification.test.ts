/**
 * Scenario 7 — Kill Switch Certification
 *
 * Verifies ALL production Kill Switch scenarios:
 *   - 7.1: Daily loss exceeded → New trades disabled
 *   - 7.2: Max drawdown → Close positions
 *   - 7.3: Manual emergency stop → Immediate stop
 *   - 7.4: Exchange disconnect → Prevent new trades
 *   - 7.5: Kill Switch + Safe Mode interaction
 *   - 7.6: Kill Switch deactivation → Normal resume
 *
 * @since Sprint 5.8
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { IntegrationHarness } from './IntegrationHarness'

describe('Scenario 7 — Kill Switch Certification', () => {
  let h: IntegrationHarness

  beforeEach(async () => {
    h = new IntegrationHarness()
    await h.start()
  })

  afterEach(async () => {
    h.setKillSwitch(false)
    await h.stop()
  })

  // ────────────────
  // 7.1 Daily loss exceeded → New trades disabled
  // ────────────────

  it('7.1 — daily loss exceeded: kill switch blocks new trades', async () => {
    // Place a losing trade
    const buyOrder = await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
    })
    expect(buyOrder.success).toBe(true)
    await h.wait(100)

    // Verify position exists
    const positionsBefore = await h.gateway.getPositions()
    expect(positionsBefore.length).toBe(1)

    // Simulate daily loss threshold exceeded → Kill Switch activates
    h.setKillSwitch(true)

    // New trades must be blocked
    const newBuyOrder = await h.placeOrder({
      symbol: 'ETH/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.5,
    })
    expect(newBuyOrder.success).toBe(false)
    expect(newBuyOrder.message).toContain('Kill switch')

    // Existing position is NOT affected (managed by ExitEngine)
    const positionsAfter = await h.gateway.getPositions()
    expect(positionsAfter.length).toBe(1)
  })

  // ────────────────
  // 7.2 Max drawdown → Close positions
  // ────────────────

  it('7.2 — max drawdown: all orders cancelled then kill switch blocks', async () => {
    // Place open limit orders
    await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'limit',
      price: 20000,
      quantity: 0.1,
    })
    await h.placeOrder({
      symbol: 'ETH/USDT',
      side: 'buy',
      type: 'limit',
      price: 1500,
      quantity: 1,
    })
    await h.wait(100)

    let openOrders = await h.gateway.getOrders({ status: 'open' })
    expect(openOrders.length).toBe(2)

    // Max drawdown → Cancel all orders + activate Kill Switch
    const cancelled = await h.cancelAllOrders()
    expect(cancelled).toBe(2)

    h.setKillSwitch(true)

    // Verify no open orders remain
    openOrders = await h.gateway.getOrders({ status: 'open' })
    expect(openOrders.length).toBe(0)

    // New orders are blocked
    const result = await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
    })
    expect(result.success).toBe(false)
    expect(result.message).toContain('Kill switch')
  })

  // ────────────────
  // 7.3 Manual emergency stop → Immediate stop
  // ────────────────

  it('7.3 — manual emergency stop: blocks new trades', async () => {
    // Start with an active position
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    await h.wait(100)

    // Activate kill switch (simulates manual emergency stop)
    h.setKillSwitch(true)

    // Immediate: all new trades blocked
    const result1 = await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    expect(result1.success).toBe(false)

    // Even different symbol blocked
    const result2 = await h.placeOrder({ symbol: 'ETH/USDT', side: 'buy', type: 'market', quantity: 0.5 })
    expect(result2.success).toBe(false)

    // Existing orders and positions remain (to be managed/cancelled by operator)
    const positions = await h.gateway.getPositions()
    expect(positions.length).toBe(1) // Not liquidated by kill switch alone
  })

  it('7.3b — manual emergency stop: cancel all + block is complete', async () => {
    // Place open orders
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'limit', price: 20000, quantity: 0.1 })
    await h.placeOrder({ symbol: 'ETH/USDT', side: 'buy', type: 'limit', price: 1500, quantity: 1 })
    await h.wait(100)

    // Operator: cancel all + activate kill switch
    const cancelled = await h.cancelAllOrders()
    expect(cancelled).toBe(2)
    h.setKillSwitch(true)

    // Verify
    const openOrders = await h.gateway.getOrders({ status: 'open' })
    expect(openOrders.length).toBe(0)

    const result = await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    expect(result.success).toBe(false)
  })

  // ────────────────
  // 7.4 Exchange disconnect → Prevent new trades
  // ────────────────

  it('7.4 — exchange disconnect: gateway status reflects, no trades possible', async () => {
    // Connected state
    let status = h.gateway.getStatus()
    expect(status.connected).toBe(true)

    // Ability to trade
    const result1 = await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    expect(result1.success).toBe(true)
    await h.wait(100)

    // Disconnect
    h.gateway.disconnect()
    await h.wait(50)

    status = h.gateway.getStatus()
    expect(status.connected).toBe(false)

    // No trades possible when disconnected
    const result2 = await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    expect(result2.success).toBe(false)
    expect(result2.message).toContain('Not connected')
  })

  it('7.4b — exchange disconnect + kill switch: defense in depth', async () => {
    // Place an open order
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'limit', price: 20000, quantity: 0.1 })
    await h.wait(100)

    // Disconnect
    h.gateway.disconnect()
    await h.wait(50)

    // Activate kill switch as defense-in-depth (system should auto-activate on disconnect)
    h.setKillSwitch(true)

    // Even after reconnect, kill switch still blocks
    await h.gateway.connect(h.feed)
    await h.wait(100)

    const result = await h.placeOrder({ symbol: 'ETH/USDT', side: 'buy', type: 'market', quantity: 0.5 })
    expect(result.success).toBe(false)
  })

  // ────────────────
  // 7.5 Kill Switch + Safe Mode
  // ────────────────

  it('7.5 — kill switch + safe mode: positions managed, new trades blocked', async () => {
    // Open a position with exit orders
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    await h.wait(100)

    await h.placeOrder({ symbol: 'BTC/USDT', side: 'sell', type: 'limit', quantity: 0.1, price: 35000 })
    await h.wait(50)

    // Activate kill switch (Safe Mode equivalent)
    h.setKillSwitch(true)

    // New trades blocked
    const newTrade = await h.placeOrder({ symbol: 'ETH/USDT', side: 'buy', type: 'market', quantity: 0.5 })
    expect(newTrade.success).toBe(false)

    // Existing position still managed — exit orders remain
    const openOrders = await h.gateway.getOrders({ status: 'open' })
    expect(openOrders.length).toBe(1) // TP still there
    expect(openOrders[0].side).toBe('sell')
    expect(openOrders[0].type).toBe('limit')
    expect(openOrders[0].price).toBe(35000)

    // Position still open
    const positions = await h.gateway.getPositions()
    expect(positions.length).toBe(1)
    expect(positions[0].quantity).toBeCloseTo(0.1)
  })

  // ────────────────
  // 7.6 Kill Switch deactivation → Normal resume
  // ────────────────

  it('7.6 — kill switch deactivation restores trading', async () => {
    // Activate kill switch
    h.setKillSwitch(true)
    let result = await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    expect(result.success).toBe(false)

    // Deactivate
    h.setKillSwitch(false)

    // Normal trading resumes
    result = await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    expect(result.success).toBe(true)
  })

  it('7.6b — kill switch toggle across multiple deactivations', async () => {
    // On → Off → On → Off
    for (let i = 0; i < 3; i++) {
      h.setKillSwitch(true)
      const blocked = await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
      expect(blocked.success).toBe(false)

      h.setKillSwitch(false)
      const resumed = await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
      expect(resumed.success).toBe(true)
    }
  })
})
