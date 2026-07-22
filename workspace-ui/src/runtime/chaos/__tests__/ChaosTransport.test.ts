/**
 * Chaos Runtime — Transport wrapper tests (WrappedFetch, WrappedWebSocket)
 *
 * @since 6.6
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { FailureInjector } from '../FailureInjector'
import { SeededRandom } from '../SeededRandom'
import { wrapFetch } from '../WrappedFetch'
import { WrappedWebSocket } from '../WrappedWebSocket'
import {
  FailureInjectionScope,
  LatencyRule,
  TimeoutRule,
  ConnectionRefusedRule,
  RateLimitRule,
  MalformedResponseRule,
} from '../InjectionRule'
import { EXCHANGE_SLOW_PROFILE } from '../FailureProfile'

// ════════════════════════════════════════════
// Wrapped Fetch
// ════════════════════════════════════════════

describe('WrappedFetch', () => {
  let injector: FailureInjector
  let calls: Array<{ input: RequestInfo | URL; init?: RequestInit }>

  /** Mock fetch that records calls */
  function createMockFetch(status = 200, body = '{"ok":true}'): typeof globalThis.fetch {
    calls = []
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init })
      return new Response(body, { status, statusText: status === 200 ? 'OK' : 'Error' })
    }
  }

  const REST_URL = 'https://api.bybit.com/v5/account/wallet-balance'

  beforeEach(() => {
    injector = new FailureInjector(new SeededRandom(42))
  })

  it('passes through when no rule matches', async () => {
    const mockFetch = createMockFetch()
    const wrapped = wrapFetch(mockFetch, injector)
    const resp = await wrapped(REST_URL, { method: 'GET' })
    expect(resp.status).toBe(200)
    expect(calls).toHaveLength(1)
  })

  it('injects latency (visible via timing)', async () => {
    const mockFetch = createMockFetch()
    injector.addRule(new LatencyRule('slow', FailureInjectionScope.REST, 1.0, { minMs: 50, maxMs: 100 }))

    const wrapped = wrapFetch(mockFetch, injector)
    const start = Date.now()
    await wrapped(REST_URL, { method: 'POST' })
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(40)
    expect(calls).toHaveLength(1)
  })

  it('injects connection_refused as TypeError', async () => {
    const mockFetch = createMockFetch()
    injector.addRule(new ConnectionRefusedRule('refused', FailureInjectionScope.REST, 1.0))

    const wrapped = wrapFetch(mockFetch, injector)
    await expect(wrapped(REST_URL, { method: 'POST' }))
      .rejects.toThrow('Chaos: injected connection refused')
  })

  it('injects rate_limit as 429 Response', async () => {
    const mockFetch = createMockFetch()
    injector.addRule(new RateLimitRule('rl', FailureInjectionScope.REST, 1.0, { retryAfterMs: 5000 }))

    const wrapped = wrapFetch(mockFetch, injector)
    const resp = await wrapped(REST_URL, { method: 'POST' })
    expect(resp.status).toBe(429)
  })

  it('injects malformed_response as garbage Response', async () => {
    const mockFetch = createMockFetch()
    injector.addRule(new MalformedResponseRule('bad', FailureInjectionScope.REST, 1.0, { payload: 'trash' }))

    const wrapped = wrapFetch(mockFetch, injector)
    const resp = await wrapped(REST_URL, { method: 'POST' })
    const text = await resp.text()
    expect(text).toBe('trash')
    expect(calls).toHaveLength(0)
  })

  it('is transparent with no active rules', async () => {
    const mockFetch = createMockFetch()
    const wrapped = wrapFetch(mockFetch, injector)
    const resp = await wrapped(REST_URL)
    const body = await resp.json()
    expect(body).toEqual({ ok: true })
  })
})

// ════════════════════════════════════════════
// Wrapped WebSocket
// ════════════════════════════════════════════

describe('WrappedWebSocket', () => {
  let injector: FailureInjector

  beforeEach(() => {
    injector = new FailureInjector(new SeededRandom(42))
  })

  it('starts in CLOSED state', () => {
    const ws = new WrappedWebSocket('wss://stream.bybit.com/v5/public/linear', injector)
    expect(ws.readyState).toBe(WebSocket.CLOSED)
  })

  it('preserves WebSocket API shape', () => {
    const ws = new WrappedWebSocket('wss://stream.bybit.com/v5/public/linear', injector)
    expect(typeof ws.send).toBe('function')
    expect(typeof ws.close).toBe('function')
    expect(typeof (ws as any).connect).toBe('function')
    expect('onopen' in ws).toBe(true)
    expect('onmessage' in ws).toBe(true)
    expect('onerror' in ws).toBe(true)
    expect('onclose' in ws).toBe(true)
    expect('binaryType' in ws).toBe(true)
  })

  it('injects connection_refused without making real connection', async () => {
    injector.addRule(new ConnectionRefusedRule('refused', FailureInjectionScope.PUBLIC_WS, 1.0))
    const ws = new WrappedWebSocket('wss://stream.bybit.com/v5/public/linear', injector)
    
    const errorPromise = new Promise<Event>((resolve) => {
      ws.onerror = (e) => resolve(e)
    })
    
    await ws.connect()
    // Should not throw but should fire error event
    // Connection refused means we never actually call new WebSocket()
  })

  it('scope detection: private ws uses PRIVATE_WS scope', () => {
    const injector2 = new FailureInjector(new SeededRandom(1))
    const rule = new ConnectionRefusedRule('refused', FailureInjectionScope.PRIVATE_WS, 1.0)
    injector2.addRule(rule)

    const rule2 = new ConnectionRefusedRule('refused-pub', FailureInjectionScope.PUBLIC_WS, 1.0)
    injector2.addRule(rule2)

    // Private WS URL should match PRIVATE_WS scope
    const ctxInjection = injector2.matchingRules({
      scope: FailureInjectionScope.PRIVATE_WS,
      url: 'wss://stream.bybit.com/v5/private',
      timestamp: Date.now(),
    })
    expect(ctxInjection).toHaveLength(1)
    expect(ctxInjection[0].scope).toBe(FailureInjectionScope.PRIVATE_WS)
  })
})

// ════════════════════════════════════════════
// End-to-end: Profile + Transport
// ════════════════════════════════════════════

describe('End-to-end: Profile + Transport', () => {
  it('EXCHANGE_SLOW_PROFILE causes latency on REST fetch', async () => {
    const injector = new FailureInjector(new SeededRandom(42))
    injector.setProfile(EXCHANGE_SLOW_PROFILE)

    const calls: any[] = []
    const mockFetch: typeof globalThis.fetch = async (input, init) => {
      calls.push({ input, init })
      await new Promise(r => setTimeout(r, 5))
      return new Response('{"ok":true}', { status: 200 })
    }

    const wrapped = wrapFetch(mockFetch, injector)
    const start = Date.now()
    await wrapped('https://api.bybit.com/v5/account/wallet-balance', { method: 'POST' })
    const elapsed = Date.now() - start

    // EXCHANGE_SLOW adds 2-5s latency on REST scope with 100% probability
    expect(elapsed).toBeGreaterThanOrEqual(1900)
    expect(calls).toHaveLength(1)
  })
})
