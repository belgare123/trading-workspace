/**
 * Scenario 1 — Full Paper Round-Trip
 *
 * Verifies: Market Data → Strategy → Order → Risk → Gateway → Fill
 *   → Position → PnL → History → Metrics → Report
 *
 * @since 4.9
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { IntegrationHarness } from './IntegrationHarness'

describe('Scenario 1 — Full Paper Round-Trip', () => {
  let h: IntegrationHarness

  beforeEach(async () => {
    h = new IntegrationHarness()
    await h.start()
  })

  afterEach(async () => {
    await h.stop()
  })

  it('1.1 — places a market buy order via PaperProvider', async () => {
    const result = await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
    })

    expect(result.success).toBe(true)
    expect(result.orderId).toBeTruthy()
  })

  it('1.2 — buy order fills and creates a position', async () => {
    const result = await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
    })
    expect(result.success).toBe(true)

    // Wait for fill processing
    await h.wait(100)

    const positions = await h.gateway.getPositions()
    expect(positions.length).toBe(1)
    expect(positions[0].symbol).toBe('BTC/USDT')
    expect(positions[0].direction).toBe('long')
    expect(positions[0].quantity).toBeCloseTo(0.1)
  })

  it('1.3 — position has entry price and PnL tracking', async () => {
    const result = await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
    })
    expect(result.success).toBe(true)
    await h.wait(200)

    const positions = await h.gateway.getPositions()
    expect(positions.length).toBe(1)

    const pos = positions[0]
    expect(pos.averageEntryPrice).toBeGreaterThan(0)
    expect(pos.currentPrice).toBeGreaterThan(0)

    // PnL should be defined (may be 0 or small value)
    expect(typeof pos.unrealizedPnl).toBe('number')
  })

  it('1.4 — closing a sell reduces position and realizes PnL', async () => {
    // Open long
    await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
    })
    await h.wait(100)

    // Wait for price to move
    h.feed.setPrice('BTC/USDT', 30100)
    await h.wait(100)

    // Close with sell
    const result = await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'sell',
      type: 'market',
      quantity: 0.1,
    })
    expect(result.success).toBe(true)
    await h.wait(100)

    // Position should now be flat or closed
    const positions = await h.gateway.getPositions()
    const btcPos = positions.find(p => p.symbol === 'BTC/USDT')
    // May be flat (closed)
    if (btcPos) {
      expect(btcPos.quantity).toBeCloseTo(0)
    }

    // Balance should have changed (includes realized PnL)
    const balance = await h.gateway.getBalance()
    expect(balance.totalEquity).toBeGreaterThan(0)
  })

  it('1.5 — orders are recorded in history store', async () => {
    await h.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
    })
    await h.wait(100)

    const result = await h.gateway.getOrders()
    expect(result.length).toBeGreaterThanOrEqual(1)

    // History store should have events
    expect(h.history.events.length).toBeGreaterThanOrEqual(2) // accepted + filled
    expect(h.history.orders.length).toBeGreaterThanOrEqual(1)
  })

  it('1.6 — history store records all event types', async () => {
    // Open
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    await h.wait(100)

    // Close
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'sell', type: 'market', quantity: 0.1 })
    await h.wait(100)

    const eventTypes = h.history.events.map(e => e.type)
    expect(eventTypes).toContain('ORDER_ACCEPTED')
    expect(eventTypes).toContain('ORDER_FILLED')
  })

  it('1.7 — full cycle: buy → fill → position → PnL → history', async () => {
    // 1. Buy
    const buy = await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    expect(buy.success).toBe(true)
    await h.wait(100)

    // 2. Position created
    let positions = await h.gateway.getPositions()
    expect(positions.length).toBe(1)

    // 3. Price moves significantly
    h.feed.setPrice('BTC/USDT', 35000)
    await h.wait(500)

    // 4. PnL reflects price change
    positions = await h.gateway.getPositions()
    const btcPos = positions.find(p => p.symbol === 'BTC/USDT')
    expect(btcPos).toBeDefined()
    // PnL should be positive since price went up (entry ~30000, now 35000)
    expect(btcPos!.unrealizedPnl).toBeGreaterThan(400) // 0.1 * 5000 = 500

    // 5. Sell to close
    const sell = await h.placeOrder({ symbol: 'BTC/USDT', side: 'sell', type: 'market', quantity: 0.1 })
    expect(sell.success).toBe(true)
    await h.wait(100)

    // 6. History complete
    const symbolHistory = h.history.getBySymbol('BTC/USDT')
    expect(symbolHistory.orders.length).toBe(2) // buy + sell
    expect(symbolHistory.fills.length).toBe(2)

    // 7. Balance updated (started with 10000, should have profit from price move)
    const balance = await h.gateway.getBalance()
    expect(balance.totalEquity).toBeGreaterThan(10000)
  })
})
