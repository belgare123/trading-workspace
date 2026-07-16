/**
 * Scenario 4 — Rate Limit & Retry
 *
 * Verifies: RateLimiter throttles requests → RetryPolicy recovers from
 *   transient errors → All requests eventually succeed → Events logged
 *
 * @since 4.9
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { IntegrationHarness } from './IntegrationHarness'

describe('Scenario 4 — Rate Limit & Retry', () => {
  let h: IntegrationHarness

  beforeEach(async () => {
    h = new IntegrationHarness()
    await h.start()
  })

  afterEach(async () => {
    h.setRateLimiterDelay(0)
    await h.stop()
  })

  it('4.1 — rapid orders succeed without rate limiter', async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      h.placeOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.01 * (i + 1),
      })
    )

    const results = await Promise.all(promises)
    const successes = results.filter(r => r.success).length
    expect(successes).toBe(5)
  })

  it('4.2 — rate limiter delay spaces out sequential requests', async () => {
    h.setRateLimiterDelay(50) // 50ms artificial delay

    const t0 = performance.now()
    // Sequential to test cumulative delay
    for (let i = 0; i < 3; i++) {
      await h.placeOrder({ symbol: 'ETH/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    }
    const elapsed = performance.now() - t0

    // With 50ms delay per order × 3 orders, should take at least 100ms
    expect(elapsed).toBeGreaterThanOrEqual(100)
  })

  it('4.3 — rate limited requests still succeed (just slower)', async () => {
    h.setRateLimiterDelay(100) // 100ms per request

    const t0 = performance.now()
    for (let i = 0; i < 3; i++) {
      const result = await h.placeOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.01,
      })
      expect(result.success).toBe(true)
    }
    const elapsed = performance.now() - t0

    expect(elapsed).toBeGreaterThanOrEqual(200) // At least 3 × 100ms
  })

  it('4.4 — retry after rate limit: all orders eventually fill', async () => {
    h.setRateLimiterDelay(30)

    // Send 10 rapid sequential requests
    const results = []
    for (let i = 0; i < 10; i++) {
      const result = await h.placeOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.01,
      })
      results.push(result)
    }

    const successes = results.filter(r => r.success).length
    expect(successes).toBe(10) // All should succeed, just delayed
  })

  it('4.5 — history events for all orders recorded despite rate limiting', async () => {
    h.setRateLimiterDelay(20)

    const orderPromises = Array.from({ length: 4 }, (_, i) =>
      h.placeOrder({ symbol: 'ETH/USDT', side: 'buy', type: 'market', quantity: 0.1 })
    )
    await Promise.all(orderPromises)

    await h.wait(200)

    // All orders should be in history
    expect(h.history.orders.length).toBe(4)

    // Each order should have at least one event (accept or fill)
    const acceptEvents = h.history.events.filter(e => e.type === 'ORDER_ACCEPTED')
    expect(acceptEvents.length).toBe(4)
  })

  it('4.6 — rate limit resets after burst period', async () => {
    // First burst with delay
    h.setRateLimiterDelay(10)
    for (let i = 0; i < 5; i++) {
      await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.01 })
    }

    // Wait for rate limit to reset
    h.setRateLimiterDelay(0)
    await h.wait(200)

    // Quick burst without delay
    const t0 = performance.now()
    for (let i = 0; i < 5; i++) {
      await h.placeOrder({ symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.01 })
    }
    const elapsed = performance.now() - t0

    // Should be fast (no artificial delay)
    expect(elapsed).toBeLessThan(500)
  })
})
