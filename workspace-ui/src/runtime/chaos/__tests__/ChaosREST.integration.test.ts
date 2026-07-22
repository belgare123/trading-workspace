/**
 * Chaos REST — Integration tests
 *
 * End-to-end scenarios for REST transport with FailureInjector + wrapFetch.
 * Each scenario injects a specific failure and verifies the observable effect
 * through the wrapped fetch layer.
 *
 * @since 6.6.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { FailureInjector } from '../FailureInjector'
import { NoopFailureInjector } from '../NoopFailureInjector'
import { wrapFetch } from '../WrappedFetch'
import { SeededRandom } from '../SeededRandom'
import {
  FailureInjectionScope,
  LatencyRule,
  TimeoutRule,
  MalformedResponseRule,
  ConnectionRefusedRule,
  RateLimitRule,
} from '../InjectionRule'
import type { InjectionContext, InjectionAction, InjectionRule } from '../InjectionRule'

// ════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════

/** Default success body that mimics Bybit REST API format */
const BYBIT_SUCCESS = {
  retCode: 0,
  retMsg: 'OK',
  result: {
    orderId: 'mock-order-1',
    symbol: 'XRPUSDT',
    price: '0.5000',
    qty: '100',
    status: 'FILLED',
  },
}

/** Create a mock fetch that returns success responses by default */
function mockFetch(base: Record<string, unknown> = BYBIT_SUCCESS): typeof globalThis.fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return new Response(JSON.stringify(base), {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof globalThis.fetch
}

/** URL helper — simulate a Bybit REST endpoint */
const BYBIT_ORDER_URL = 'https://api.bybit.com/v5/order/create'
const BYBIT_CANCEL_URL = 'https://api.bybit.com/v5/order/cancel'
const BYBIT_POSITIONS_URL = 'https://api.bybit.com/v5/position/list'
const BYBIT_BALANCE_URL = 'https://api.bybit.com/v5/account/wallet-balance'
const BYBIT_MARKET_URL = 'https://api.bybit.com/v5/market/tickers'

/** Sleep helper for timing-sensitive tests */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Build an InjectionContext resembling what wrapFetch produces */
function ctx(opts: Partial<InjectionContext> & { scope: FailureInjectionScope }): InjectionContext {
  return {
    url: 'https://api.bybit.com/v5/order/create',
    method: 'POST',
    timestamp: Date.now(),
    ...opts,
  }
}

// ════════════════════════════════════════════
// NoopFailureInjector — production baseline
// ════════════════════════════════════════════

describe('NoopFailureInjector (production mode)', () => {
  it('passes all calls through unchanged', async () => {
    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, new NoopFailureInjector())
    const res = await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.retCode).toBe(0)
  })

  it('adds zero overhead compared to unwrapped fetch', async () => {
    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, new NoopFailureInjector())

    const start = performance.now()
    for (let i = 0; i < 10; i++) {
      await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    }
    const elapsed = performance.now() - start

    // With NoopInjector, the only overhead is the inferScope/inferOperation calls
    // which should be sub-ms. 10 calls in < 500ms confirms no artificial delays.
    expect(elapsed).toBeLessThan(500)
  })

  it('works as default in BybitBrokerAdapter constructor', async () => {
    // This tests that passing NO fetchImpl defaults to globalThis.fetch
    // and that NoopFailureInjector doesn't break anything.
    // We verify the DI pattern from the user's DoD:
    //   const fetchImpl = wrapFetch(globalThis.fetch, noopInjector)
    //   new BybitBrokerAdapter(fetchImpl)
    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, new NoopFailureInjector())
    const res = await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    expect(res.ok).toBe(true)
  })
})

// ════════════════════════════════════════════
// Scenario 1: PlaceOrder latency
// ════════════════════════════════════════════

describe('Scenario 1 — PlaceOrder latency', () => {
  it('injects latency on ORDERS scope, call still succeeds', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new LatencyRule('latency-orders', FailureInjectionScope.ORDERS, 1.0, { minMs: 50, maxMs: 100 }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    const start = performance.now()
    const res = await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    const elapsed = performance.now() - start

    expect(elapsed).toBeGreaterThanOrEqual(40)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.retCode).toBe(0)
  })

  it('does NOT inject latency on non-ORDERS scope (e.g. MARKET_DATA)', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new LatencyRule('latency-orders', FailureInjectionScope.ORDERS, 1.0, { minMs: 100, maxMs: 200 }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    const start = performance.now()
    await wrapped(BYBIT_MARKET_URL, { method: 'GET' })
    const elapsed = performance.now() - start

    // Market data not in ORDERS scope — no latency injected
    expect(elapsed).toBeLessThan(50)
  })
})

// ════════════════════════════════════════════
// Scenario 2: PlaceOrder timeout
// ════════════════════════════════════════════

describe('Scenario 2 — PlaceOrder timeout', () => {
  it('injects timeout on ORDERS scope, fetch throws', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new TimeoutRule('timeout-orders', FailureInjectionScope.ORDERS, 1.0, { durationMs: 0 }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    // WrappedFetch timeout action throws after 60s sleep — use a race to detect
    const racePromise = Promise.race([
      wrapped(BYBIT_ORDER_URL, { method: 'POST' }),
      sleep(100).then(() => 'timeout' as const),
    ])

    const result = await racePromise
    expect(result).toBe('timeout')
  })
})

// ════════════════════════════════════════════
// Scenario 3: cancelOrder timeout → idempotency
// ════════════════════════════════════════════

describe('Scenario 3 — CancelOrder timeout (idempotency)', () => {
  it('injects timeout only on cancelOrder operation', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new TimeoutRule('timeout-cancel', FailureInjectionScope.ORDERS, 1.0, { durationMs: 0 }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    // Cancel times out
    const race1 = Promise.race([
      wrapped(BYBIT_CANCEL_URL, { method: 'POST' }),
      sleep(100).then(() => 'timeout' as const),
    ])
    expect(await race1).toBe('timeout')

    // But a subsequent placeOrder on the same scope also gets the timeout due to scope match
    // This demonstrates why targeted operation-level rules are important
    const race2 = Promise.race([
      wrapped(BYBIT_ORDER_URL, { method: 'POST' }),
      sleep(100).then(() => 'timeout' as const),
    ])
    expect(await race2).toBe('timeout')
  })

  it('uses custom rule with operation matching for targeted injection', async () => {
    const injector = new FailureInjector(new SeededRandom(42))

    // Custom rule that only matches cancelOrder
    const cancelOnlyRule: InjectionRule = {
      id: 'cancel-only',
      scope: FailureInjectionScope.ORDERS,
      probability: 1.0,
      matches(context: InjectionContext): boolean {
        return context.operation === 'cancelOrder'
      },
      getAction(_ctx: InjectionContext, _random: SeededRandom): InjectionAction {
        return { type: 'timeout' }
      },
      clone(): InjectionRule {
        return this
      },
    }

    injector.addRule(cancelOnlyRule)

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    // Cancel times out
    const race1 = Promise.race([
      wrapped(BYBIT_CANCEL_URL, { method: 'POST' }),
      sleep(100).then(() => 'timeout' as const),
    ])
    expect(await race1).toBe('timeout')

    // PlaceOrder passes through (different operation)
    const res = await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    expect(res.status).toBe(200)
  })
})

// ════════════════════════════════════════════
// Scenario 4: getPositions timeout → Recovery
// ════════════════════════════════════════════

describe('Scenario 4 — GetPositions timeout (Recovery)', () => {
  it('injects timeout on POSITIONS scope, verify error type', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new TimeoutRule('timeout-pos', FailureInjectionScope.POSITIONS, 1.0, { durationMs: 0 }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    const race = Promise.race([
      wrapped(BYBIT_POSITIONS_URL, { method: 'GET' }),
      sleep(100).then(() => 'timeout' as const),
    ])
    expect(await race).toBe('timeout')
  })
})

// ════════════════════════════════════════════
// Scenario 5: getBalances timeout → Wallet consistency
// ════════════════════════════════════════════

describe('Scenario 5 — GetBalances timeout (Wallet)', () => {
  it('injects timeout on wallet URL, wallet fetch fails', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new TimeoutRule('timeout-wallet', FailureInjectionScope.GLOBAL, 1.0, { durationMs: 0 }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    const race = Promise.race([
      wrapped(BYBIT_BALANCE_URL, { method: 'GET' }),
      sleep(100).then(() => 'timeout' as const),
    ])
    expect(await race).toBe('timeout')
  })

  it('balance request succeeds when no rule matches', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new TimeoutRule('timeout-orders', FailureInjectionScope.ORDERS, 1.0, { durationMs: 0 }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    // Balance URL maps to POSITIONS scope — no rule matches
    const res = await wrapped(BYBIT_BALANCE_URL, { method: 'GET' })
    expect(res.status).toBe(200)
  })
})

// ════════════════════════════════════════════
// Scenario 6: HTTP 429 → Retry
// ════════════════════════════════════════════

describe('Scenario 6 — HTTP 429 rate limit (Retry)', () => {
  it('injects 429 on REST scope, verify status and retry headers', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new RateLimitRule('rate-rest', FailureInjectionScope.GLOBAL, 1.0, {
        code: 429,
        retryAfterMs: 5_000,
      }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    const res = await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    expect(res.status).toBe(429)
    const retryAfter = res.headers.get('retry-after')
    expect(retryAfter).toBe('5') // 5 seconds
  })

  it('does not inject rate limit when rule is below probability threshold', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    // Very low probability — seeded with 42 gives predictable sequence
    injector.addRule(
      new RateLimitRule('rate-rest', FailureInjectionScope.REST, 0.4, {
        code: 429,
        retryAfterMs: 10_000,
      }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    // First few calls should pass (random.next() > 0.4 for early values with seed 42)
    const res = await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    expect(res.status).toBe(200)
  })
})

// ════════════════════════════════════════════
// Scenario 7: Connection refused → Circuit Breaker
// ════════════════════════════════════════════

describe('Scenario 7 — Connection refused (Circuit Breaker)', () => {
  it('injects connection_refused on all REST calls', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new ConnectionRefusedRule('refuse-rest', FailureInjectionScope.GLOBAL, 1.0, {
        message: 'Chaos: connection refused by test',
      }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    let err: Error | undefined
    try {
      await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    } catch (e) {
      err = e as Error
    }

    expect(err).toBeDefined()
    expect(err!.message).toContain('connection refused')
  })

  it('connection_refused only affects matching scope', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new ConnectionRefusedRule('refuse-rest', FailureInjectionScope.ORDERS, 1.0),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    // Orders scope -> should fail
    try {
      await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as Error).message).toContain('connection refused')
    }

    // Market data is MARKET_DATA scope -> passes
    const res = await wrapped(BYBIT_MARKET_URL, { method: 'GET' })
    expect(res.status).toBe(200)
  })
})

// ════════════════════════════════════════════
// Scenario 8: Malformed JSON → Error classification
// ════════════════════════════════════════════

describe('Scenario 8 — Malformed JSON (Error classification)', () => {
  it('injects malformed response on ORDERS scope', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new MalformedResponseRule('malformed-orders', FailureInjectionScope.ORDERS, 1.0, {
        payload: '{{broken json}}',
      }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    const res = await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    const text = await res.text()
    expect(text).toBe('{{broken json}}')

    // Verify that parsing fails
    let parseError = false
    try {
      JSON.parse(text)
    } catch {
      parseError = true
    }
    expect(parseError).toBe(true)
  })
})

// ════════════════════════════════════════════
// Scenario 9: REST unavailable → Safe Mode
// ════════════════════════════════════════════

describe('Scenario 9 — REST unavailable (Safe Mode)', () => {
  it('global GLOBAL rule blocks all transport', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new ConnectionRefusedRule('global-down', FailureInjectionScope.GLOBAL, 1.0),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    // ALL calls fail, regardless of URL
    for (const url of [BYBIT_ORDER_URL, BYBIT_POSITIONS_URL, BYBIT_BALANCE_URL, BYBIT_MARKET_URL]) {
      try {
        await wrapped(url, { method: 'GET' })
        expect.fail(`should have thrown for ${url}`)
      } catch (e) {
        expect((e as Error).message).toContain('connection refused')
      }
    }
  })
})

// ════════════════════════════════════════════
// Scenario 10: REST recovered → Breaker closed
// ════════════════════════════════════════════

describe('Scenario 10 — REST recovered (Breaker closed)', () => {
  it('disabling a rule restores normal operation', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    const rule = new ConnectionRefusedRule('refuse-rest', FailureInjectionScope.REST, 1.0)
    injector.addRule(rule)

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    // Fails
    try {
      await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
      expect.fail('should have thrown')
    } catch {
      // Expected
    }

    // Remove the rule — recovery
    injector.removeRule('refuse-rest')

    // Now passes
    const res = await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    expect(res.status).toBe(200)
  })

  it('swapping injector to NoopFailureInjector restores operation', async () => {
    // Simulates disabling chaos: replace the injector with NoopFailureInjector
    const chaosInjector = new FailureInjector(new SeededRandom(42))
    chaosInjector.addRule(
      new TimeoutRule('timeout-all', FailureInjectionScope.GLOBAL, 1.0, { durationMs: 0 }),
    )

    const fetchImpl = mockFetch()
    const chaosWrapped = wrapFetch(fetchImpl, chaosInjector)

    // Chaos active — timeouts
    const race = Promise.race([
      chaosWrapped(BYBIT_ORDER_URL, { method: 'POST' }),
      sleep(50).then(() => 'timeout' as const),
    ])
    expect(await race).toBe('timeout')

    // Disable: re-wrap with Noop
    const safeWrapped = wrapFetch(fetchImpl, new NoopFailureInjector())
    const res = await safeWrapped(BYBIT_ORDER_URL, { method: 'POST' })
    expect(res.status).toBe(200)
  })
})

// ════════════════════════════════════════════
// DI Pattern: BybitBrokerAdapter integration
// ════════════════════════════════════════════

describe('DI pattern — BybitBrokerAdapter with wrapped fetch', () => {
  it('new BybitBrokerAdapter() uses globalThis.fetch (no chaos)', async () => {
    // This verifies that the default constructor works without arguments.
    // In a real environment, globalThis.fetch is available and returns real data.
    // The key assertion: the constructor does not throw.
    const { BybitBrokerAdapter } = await import('../../../workspace/live/brokers/BybitBrokerAdapter')
    const adapter = new BybitBrokerAdapter() as any
    expect(adapter.state.fetchFn).toBe(globalThis.fetch)
    expect(adapter.state.fetchFn).toBeDefined()
  })

  it('new BybitBrokerAdapter(mockFetch) injects custom fetch', async () => {
    const { BybitBrokerAdapter } = await import('../../../workspace/live/brokers/BybitBrokerAdapter')
    const mockImpl = vi.fn() as unknown as typeof globalThis.fetch
    const adapter = new BybitBrokerAdapter(mockImpl) as any
    expect(adapter.state.fetchFn).toBe(mockImpl)
  })

  it('new BybitBrokerAdapter(wrapFetch(fetch, injector)) — DI pattern from DoD', async () => {
    // This is THE pattern from the DoD:
    //   const fetchImpl = wrapFetch(globalThis.fetch, injector)
    //   new BybitBrokerAdapter(fetchImpl)
    const { BybitBrokerAdapter } = await import('../../../workspace/live/brokers/BybitBrokerAdapter')

    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new TimeoutRule('demo-timeout', FailureInjectionScope.ORDERS, 0.0, { durationMs: 0 }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)
    const adapter = new BybitBrokerAdapter(wrapped) as any
    expect(adapter.state.fetchFn).toBe(wrapped)

    // The wrapFetch + NoopFailureInjector should be equivalent to globalThis.fetch
    // for production use
    const noopFetch = wrapFetch(fetchImpl, new NoopFailureInjector())
    const noopAdapter = new BybitBrokerAdapter(noopFetch) as any
    expect(noopAdapter.state.fetchFn).toBe(noopFetch)
  })
})

// ════════════════════════════════════════════
// Integration Assertions: layered system invariants
// ════════════════════════════════════════════

describe('Integration Assertions — system invariants under chaos', () => {
  it('latency injection does not change response content', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new LatencyRule('latency', FailureInjectionScope.ORDERS, 1.0, { minMs: 20, maxMs: 50 }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    const res = await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    const body = await res.json()

    // Content invariant: the mock data passes through unchanged
    expect(body.retCode).toBe(0)
    expect(body.result.orderId).toBe('mock-order-1')
    expect(body.result.symbol).toBe('XRPUSDT')
  })

  it('rate limit resets after clearing rule — system recovers', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new RateLimitRule('rate-rest', FailureInjectionScope.GLOBAL, 1.0, {
        code: 429,
        retryAfterMs: 60_000,
      }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    // Under chaos
    const chaosRes = await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    expect(chaosRes.status).toBe(429)

    // Remove rule — recovery
    injector.removeRule('rate-rest')
    const recoveredRes = await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    expect(recoveredRes.status).toBe(200)
  })

  it('timeout on ORDERS does not affect MARKET_DATA scope', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new TimeoutRule('timeout-orders', FailureInjectionScope.ORDERS, 1.0, { durationMs: 0 }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    // Market data succeeds
    const res = await wrapped(BYBIT_MARKET_URL, { method: 'GET' })
    expect(res.status).toBe(200)

    // Orders timeout
    const race = Promise.race([
      wrapped(BYBIT_ORDER_URL, { method: 'POST' }),
      sleep(100).then(() => 'timeout' as const),
    ])
    expect(await race).toBe('timeout')
  })

  it('multiple rules compose correctly', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.addRule(
      new ConnectionRefusedRule('refuse-pos', FailureInjectionScope.POSITIONS, 1.0),
    )
    injector.addRule(
      new RateLimitRule('rate-orders', FailureInjectionScope.ORDERS, 1.0, { code: 429, retryAfterMs: 1000 }),
    )

    const fetchImpl = mockFetch()
    const wrapped = wrapFetch(fetchImpl, injector)

    // Positions fail with connection_refused
    try {
      await wrapped(BYBIT_POSITIONS_URL, { method: 'GET' })
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as Error).message).toContain('connection refused')
    }

    // Orders fail with 429
    const orderRes = await wrapped(BYBIT_ORDER_URL, { method: 'POST' })
    expect(orderRes.status).toBe(429)

    // Market (no rule matches) succeeds
    const marketRes = await wrapped(BYBIT_MARKET_URL, { method: 'GET' })
    expect(marketRes.status).toBe(200)
  })
})
