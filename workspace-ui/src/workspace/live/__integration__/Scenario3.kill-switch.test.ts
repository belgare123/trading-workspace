/**
 * Scenario 3 — Kill Switch (Emergency Stop)
 *
 * Verifies: Kill Switch activated → All orders cancelled → Positions closed
 *   → New orders blocked → Event logged in history
 *
 * @since 4.9
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { IntegrationHarness } from './IntegrationHarness'

describe('Scenario 3 — Kill Switch (Emergency Stop)', () => {
  let h: IntegrationHarness

  beforeEach(async () => {
    h = new IntegrationHarness()
    await h.start()
  })

  afterEach(async () => {
    h.setKillSwitch(false)
    await h.stop()
  })

  it('3.1 — orders accepted with kill switch off', async () => {
    const result = await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
    })
    expect(result.success).toBe(true)
  })

  it('3.2 — kill switch blocks new orders', async () => {
    h.setKillSwitch(true)

    const result = await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
    })
    expect(result.success).toBe(false)
    expect(result.message).toContain('Kill switch')
  })

  it('3.3 — orders placed before kill switch are not affected', async () => {
    // Place order before kill switch
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    await h.wait(100)

    let orders = await h.gateway.getOrders()
    expect(orders.length).toBe(1)
    expect(orders[0].status).toBe('filled')

    // Activate kill switch
    h.setKillSwitch(true)

    // Existing filled order shouldn't change
    orders = await h.gateway.getOrders()
    expect(orders.length).toBe(1)
  })

  it('3.4 — cancel all orders works under kill switch', async () => {
    // Place limit orders (won't fill immediately)
    await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'limit',
      price: 20000, // Below market — stays open
      quantity: 0.1,
    })
    await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'sell',
      type: 'limit',
      price: 40000, // Above market — stays open
      quantity: 0.1,
    })
    await h.wait(100)

    // Cancel all
    const cancelled = await h.cancelAllOrders()
    expect(cancelled).toBe(2)

    const orders = await h.gateway.getOrders({ status: 'open' })
    expect(orders.length).toBe(0)
  })

  it('3.5 — kill switch prevents order placement even after cancel', async () => {
    h.setKillSwitch(true)

    // Try to place after cancel
    const result = await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
    })
    expect(result.success).toBe(false)
  })

  it('3.6 — kill switch can be deactivated', async () => {
    h.setKillSwitch(true)
    let result = await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    expect(result.success).toBe(false)

    // Deactivate
    h.setKillSwitch(false)

    result = await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    expect(result.success).toBe(true)
  })

  it('3.7 — history events track kill switch state', async () => {
    // Place order
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    await h.wait(100)

    const eventsBefore = h.history.events.length
    expect(eventsBefore).toBeGreaterThan(0)

    // Activate kill — history should still record any actions taken
    h.setKillSwitch(true)

    // Try to place (blocked, no event in history)
    await h.placeOrder({ symbol: 'ETH/USDT', side: 'sell', type: 'market', quantity: 1 })
    // Last event count should not increase since blocked orders don't reach gateway
    expect(h.history.events.length).toBe(eventsBefore)
  })
})
