/**
 * WrappedFetch.ts — fetch wrapper that injects failures transparently
 *
 * Wraps the global fetch function so that every outbound HTTP request
 * passes through the FailureInjector. No existing code needs to change.
 *
 * Usage:
 *   const injector = new FailureInjector()
 *   const safeFetch = wrapFetch(globalThis.fetch, injector)
 *   // Use safeFetch everywhere
 *
 * Each wrapped call enriches the FailureContext with operation hints
 * derived from the URL and HTTP method, and notifies the injector
 * when the injection effect completes (injection_finished).
 *
 * @since 6.6
 */

import type { FailureInjector } from './FailureInjector'
import { FailureInjectionScope } from './InjectionRule'
import type { InjectionContext, InjectionAction } from './InjectionRule'
import type { ChaosTrace, ChaosTracePhase } from './ChaosTrace'
import { nextChaosTraceId } from './ChaosTrace'
import type { IFailureObserver } from './IFailureObserver'

/** Create a wrapped fetch that intercepts through the given injector */
export function wrapFetch(
  original: typeof globalThis.fetch,
  injector: FailureInjector,
  traceObserver?: IFailureObserver,
): typeof globalThis.fetch {
  return async function chaosFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : 'url' in input ? input.url
      : String(input)
    const method = (init?.method ?? (typeof input === 'string' ? 'GET' : 'GET')).toUpperCase()

    // Derive scope and operation from URL/method
    const scope = inferScope(url, method)
    const operation = inferOperation(url, method)

    const context = {
      scope,
      url,
      method,
      operation,
      requestBody: init?.body,
      timestamp: Date.now(),
    }

    const action = await injector.evaluate(context)

    // ── No injection — pass through unchanged ──
    if (action.type === 'none') {
      return original(input, init)
    }

    // ── Chaos trace lifecycle ──
    const traceId = nextChaosTraceId()
    const trace: ChaosTrace = {
      id: traceId,
      ruleId: '', // will be set after evaluate
      scope,
      actionType: action.type,
      startedAt: Date.now(),
      status: 'running',
    }

    // Try to find which rule matched from the injector's context
    // (rules aren't exposed individually through evaluate, but the
    //  injection_finished observer still fires in the injector)

    if (traceObserver) {
      traceObserver.onChaosTrace?.(trace)
      traceObserver.onChaosEvent?.({
        traceId,
        timestamp: Date.now(),
        phase: 'started',
        message: `Rule matched — injecting ${action.type}`,
        data: { context, action },
      })
    }

    const startTime = Date.now()

    try {
      return await applyAction(original, input, init, context, action, traceObserver, traceId, startTime)
    } finally {
      if (traceObserver) {
        trace.status = 'completed'
        trace.finishedAt = Date.now()
        traceObserver.onChaosTrace?.(trace)
      }
    }
  }
}

// ── Apply a single injection action ──

async function applyAction(
  original: typeof globalThis.fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  context: InjectionContext,
  action: InjectionAction,
  traceObserver: IFailureObserver | undefined,
  traceId: string,
  startTime: number,
): Promise<Response> {
  const emitEvent = (phase: ChaosTracePhase, message: string, data?: unknown) => {
    traceObserver?.onChaosEvent?.({
      traceId,
      timestamp: Date.now(),
      phase,
      message,
      data,
    })
  }

  emitEvent('effect', `Applying ${action.type} action`)

  switch (action.type) {
    case 'latency': {
      await sleep(action.duration)
      emitEvent('effect', `Latency applied: ${action.duration}ms`)
      const result = await original(input, init)
      emitEvent('finished', 'Request completed after latency')
      return result
    }

    case 'timeout': {
      emitEvent('effect', 'Timeout injected — hanging indefinitely')
      await sleep(60_000) // never resolves
      throw new DOMException('Chaos: injected timeout', 'TimeoutError')
    }

    case 'connection_refused': {
      const error = new TypeError('Chaos: injected connection refused')
      emitEvent('effect', 'Connection refused injected', { message: error.message })
      throw error
    }

    case 'packet_loss': {
      await sleep(60_000) // connection drops silently
      const error = new TypeError('Chaos: injected packet loss')
      emitEvent('effect', 'Packet loss injected', { message: error.message })
      throw error
    }

    case 'partial_response': {
      const resp = await original(input, init)
      const text = await resp.text()
      const truncated = text.slice(0, action.size)
      const partial = new Response(truncated, {
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers,
      })
      Object.defineProperty(partial, 'ok', { get: () => false })
      emitEvent('effect', `Response truncated to ${action.size} bytes`)
      emitEvent('finished', 'Partial response returned')
      return partial
    }

    case 'malformed_response': {
      const result = new Response(action.payload, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      })
      emitEvent('effect', 'Malformed JSON response injected')
      emitEvent('finished', 'Malformed response returned')
      return result
    }

    case 'rate_limit': {
      const result = new Response(JSON.stringify({
        retryAfterMs: action.retryAfterMs,
        code: action.code,
        message: 'Chaos: injected rate limit',
      }), {
        status: action.code,
        statusText: 'Too Many Requests',
        headers: { 'retry-after': String(Math.ceil(action.retryAfterMs / 1000)) },
      })
      emitEvent('effect', `Rate limit injected: ${action.code}`, { retryAfterMs: action.retryAfterMs })
      emitEvent('finished', 'Rate limit response returned')
      return result
    }

    case 'disconnect': {
      const error = new TypeError('Chaos: injected disconnect')
      emitEvent('effect', 'Disconnect injected', { message: error.message })
      throw error
    }

    default:
      return original(input, init)
  }
}

/** Infer scope from URL path */
function inferScope(url: string, method: string): FailureInjectionScope {
  const lower = url.toLowerCase()
  if (lower.includes('/order') || lower.includes('/trade')) {
    return FailureInjectionScope.ORDERS
  }
  if (lower.includes('/position') || lower.includes('/asset') || lower.includes('/balance')) {
    return FailureInjectionScope.POSITIONS
  }
  if (lower.includes('/market') || lower.includes('/ticker') || lower.includes('/kline')) {
    return FailureInjectionScope.MARKET_DATA
  }
  if (lower.includes('/ws/') || lower.includes('/websocket')) {
    return lower.includes('private')
      ? FailureInjectionScope.PRIVATE_WS
      : FailureInjectionScope.PUBLIC_WS
  }
  return FailureInjectionScope.REST
}

/** Derive a high-level operation name from URL path + method */
function inferOperation(url: string, method: string): string {
  const lower = url.toLowerCase()
  const path = new URL(url).pathname

  // Order operations
  if (lower.includes('/order/create') || lower.includes('/trade/order') && method === 'POST') return 'placeOrder'
  if (lower.includes('/order/amend') || lower.includes('/trade/amend')) return 'amendOrder'
  if (lower.includes('/order/cancel') || lower.includes('/trade/cancel') ||
      (lower.includes('/order/') && method === 'DELETE')) return 'cancelOrder'
  if (lower.includes('/order/list') || lower.includes('/order/history') || lower.includes('/trade/history')) return 'listOrders'

  // Position operations
  if (lower.includes('/position/list') || lower.includes('/position/info')) return 'getPositions'
  if (lower.includes('/position/risk-limit') || lower.includes('/position/set-leverage')) return 'setLeverage'

  // Account / wallet
  if (lower.includes('/account/') || lower.includes('/wallet/')) return 'getBalances'

  // Market data
  if (lower.includes('/market/tickers') || lower.includes('/ticker/price')) return 'getTickers'
  if (lower.includes('/market/kline')) return 'getKlines'
  if (lower.includes('/market/depth') || lower.includes('/market/orderbook')) return 'getOrderBook'

  // Fallback to path segment
  const segments = path.split('/').filter(Boolean)
  if (segments.length >= 2) {
    return `${method.toLowerCase()}_${segments[segments.length - 1]}`
  }
  return `${method.toLowerCase()}_api`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
