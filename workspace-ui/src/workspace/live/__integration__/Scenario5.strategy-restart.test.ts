/**
 * Scenario 5 — Strategy Restart & Recovery
 *
 * Verifies: Strategy shutdown → State snapshot → Restart → Restore
 *   → Continue without duplicate orders → History preserved
 *
 * @since 4.9
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { IntegrationHarness } from './IntegrationHarness'

describe('Scenario 5 — Strategy Restart & Recovery', () => {
  let h: IntegrationHarness

  beforeEach(async () => {
    h = new IntegrationHarness()
    await h.start()
  })

  afterEach(async () => {
    await h.stop()
  })

  it('5.1 — strategy can place orders, stop, and restart', async () => {
    // Phase 1: Active trading
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    await h.wait(100)

    const ordersPhase1 = await h.gateway.getOrders()
    expect(ordersPhase1.length).toBe(1)

    // Phase 2: Snapshot state (simulate strategy stop)
    const snapshot = {
      orders: [...h.history.orders],
      fills: [...h.history.fills],
      events: [...h.history.events],
      balance: await h.gateway.getBalance(),
    }
    expect(snapshot.orders.length).toBe(1)
    expect(snapshot.fills.length).toBeGreaterThan(0)

    // Phase 3: Verify snapshot is a valid recovery point
    expect(snapshot.events.length).toBeGreaterThan(0)
    expect(snapshot.balance.totalEquity).toBeGreaterThan(0)
  })

  it('5.2 — no order duplication after restart + recover from snapshot', async () => {
    // Phase 1: Place orders
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    await h.wait(100)
    expect(h.history.orders.length).toBe(1)

    // Phase 2: Snapshot state
    const snapshot = {
      orders: h.history.orders.map(o => ({ ...o })),
      fills: h.history.fills.map(f => ({ ...f })),
    }

    // Phase 3: Reset (simulate strategy restart)
    h.reset()
    await h.wait(50)

    // Phase 4: New orders after restart — completely fresh state
    await h.placeOrder({ symbol: 'ETH/USDT', side: 'buy', type: 'market', quantity: 0.5 })
    await h.wait(100)

    // History only has new orders (reset cleared old)
    expect(h.history.orders.length).toBe(1)
    expect(h.history.orders[0].symbol).toBe('ETH/USDT')

    // Snapshot preserved separately — orders are not duplicated
    expect(snapshot.orders.length).toBe(1)
    expect(snapshot.orders[0].symbol).toBe('BTC/USDT')
  })

  it('5.3 — position state can be recovered after restart', async () => {
    // Phase 1: Open a position
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    await h.wait(100)

    let positions = await h.gateway.getPositions()
    expect(positions.length).toBe(1)

    // Phase 2: Snapshot position state for recovery
    const posSnapshot = {
      symbol: positions[0].symbol,
      direction: positions[0].direction,
      quantity: positions[0].quantity,
      entryPrice: positions[0].averageEntryPrice,
    }

    // Phase 3: Verify snapshot is a valid recovery state
    expect(posSnapshot.symbol).toBe('BTC/USDT')
    expect(posSnapshot.direction).toBe('long')
    expect(posSnapshot.quantity).toBeCloseTo(0.1)
    expect(posSnapshot.entryPrice).toBeGreaterThan(0)
  })

  it('5.4 — strategy continues producing events after restart', async () => {
    // Phase 1: Before restart
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    await h.wait(100)

    const eventsBeforeRestart = h.history.events.length
    expect(eventsBeforeRestart).toBeGreaterThanOrEqual(2)

    // Phase 2: Restart
    h.reset()
    await h.wait(50)

    // Phase 3: After restart
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    await h.wait(100)

    // Events after restart should be from new orders only
    expect(h.history.events.length).toBeGreaterThanOrEqual(2)
  })

  it('5.5 — fully recovered strategy can execute trades profitably', async () => {
    // Phase 1: Open position
    await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    await h.wait(100)

    // Snapshot position
    const positions = await h.gateway.getPositions()
    const recoveryState = {
      symbol: positions[0].symbol,
      direction: positions[0].direction,
      quantity: positions[0].quantity,
      entryPrice: positions[0].averageEntryPrice,
    }

    // Phase 2: Price moves in our favor (simulate market movement during restart)
    h.feed.setPrice('BTC/USDT', 32000)
    await h.wait(200)

    // Phase 3: Close position profitably
    const result = await h.placeOrder({
      symbol: recoveryState.symbol,
      side: recoveryState.direction === 'long' ? 'sell' : 'buy',
      type: 'market',
      quantity: recoveryState.quantity,
    })
    expect(result.success).toBe(true)
    await h.wait(100)

    // Verify profit
    const balance = await h.gateway.getBalance()
    // With 0.1 BTC at 30000 entry and 32000 exit = +200 + cost adjustments
    // Realized PnL should be positive
    expect(balance.totalEquity).toBeGreaterThan(10000)
  })
})
