/**
 * BybitFeedAdapter.integration.test.ts — Smoke tests for DI integration
 *
 * Sprint 6.6.3a — Production Feed Integration.
 *
 * Verifies that WrappedWebSocket can be injected into BybitFeedAdapter
 * through the IWebSocketFactory interface without production regressions.
 *
 * 4 smoke scenarios:
 *   1. Normal connection (default factory, no chaos)
 *   2. WrappedWebSocket without active rules (chaos factory, empty injector)
 *   3. WrappedWebSocket with latency rule applied during connect
 *   4. WrappedWebSocket with disconnect rule applied after connect
 *
 * @since 6.6.3a
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BybitFeedAdapter } from './BybitFeedAdapter'
import { FailureInjector, SeededRandom, ChaosWebSocketFactory, FailureInjectionScope, LatencyRule, DisconnectRule } from '../../../runtime/chaos'

// ── Mock WebSocket ──

let lastMock: MockSocket | null = null

class MockSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  onopen: ((e: any) => void) | null = null
  onmessage: ((e: any) => void) | null = null
  onerror: ((e: any) => void) | null = null
  onclose: ((e: any) => void) | null = null
  readyState: number = MockSocket.OPEN
  url: string

  constructor(url: string) {
    this.url = url
    lastMock = this
  }

  /** Matches WebSocket.close() — fires onclose for clean lifecycle */
  close(code?: number): void {
    this.readyState = MockSocket.CLOSED
    if (this.onclose) {
      this.onclose({ code: code ?? 1000, wasClean: true } as any)
    }
  }
}

function getMock(): MockSocket {
  if (!lastMock) throw new Error('No mock WebSocket created')
  return lastMock
}

function openMock(): void {
  getMock().onopen?.(null as any)
}

let origWebSocket: unknown

beforeEach(() => {
  lastMock = null
  origWebSocket = (globalThis as any).WebSocket
  ;(globalThis as any).WebSocket = MockSocket as any
})

afterEach(() => {
  ;(globalThis as any).WebSocket = origWebSocket
})

/** Helper: connect adapter and open the underlying mock WebSocket */
async function connectAndOpen(adapter: BybitFeedAdapter): Promise<void> {
  const connectPromise = adapter.connect()
  // yield to microtask queue so createRealSocket / mock WS can be created
  await new Promise(r => setTimeout(r, 0))
  // Only open if a mock was created (native factory creates on new WebSocket())
  // With chaos factory, WrappedWebSocket.connect() evaluates rules first
  if (lastMock) {
    openMock()
  }
  await connectPromise
}

// ── Smoke Tests ──

describe('Sprint 6.6.3a — BybitFeedAdapter + WrappedWebSocket DI', () => {
  it('smoke 1: normal connection (default factory, no chaos)', async () => {
    const adapter = new BybitFeedAdapter()

    const connectPromise = adapter.connect()
    expect(getMock()).toBeDefined()
    expect((adapter as any)._state).toBe('connecting')

    openMock()
    await connectPromise

    expect(adapter.isConnected).toBe(true)
    await adapter.disconnect()
    expect(adapter.isConnected).toBe(false)
  })

  it('smoke 2: WrappedWebSocket without active rules', async () => {
    const emptyInjector = new FailureInjector(new SeededRandom(0))
    const factory = new ChaosWebSocketFactory(emptyInjector)
    const adapter = new BybitFeedAdapter(factory)

    await connectAndOpen(adapter)

    expect(adapter.isConnected).toBe(true)

    // Verify the mock WebSocket was used
    const m = getMock()
    expect(m.readyState).toBe(MockSocket.OPEN)

    await adapter.disconnect()
    expect(adapter.isConnected).toBe(false)
  })

  it('smoke 3: WrappedWebSocket with latency rule', async () => {
    const injector = new FailureInjector(new SeededRandom(0))
    injector.addRule(new LatencyRule('slow', FailureInjectionScope.PUBLIC_WS, 1.0, { minMs: 15, maxMs: 25 }))

    const factory = new ChaosWebSocketFactory(injector)
    const adapter = new BybitFeedAdapter(factory)

    const t0 = Date.now()

    // connect() — internally WrappedWebSocket hits latency sleep
    const connectPromise = adapter.connect()
    expect(adapter.isConnected).toBe(false)

    // The factory fires connect() which sleeps for latency first
    await new Promise(r => setTimeout(r, 10))
    expect(adapter.isConnected).toBe(false) // still sleeping

    // Wait for latency to finish, then open the mock
    await new Promise(r => setTimeout(r, 30))
    if (lastMock) openMock()
    await connectPromise

    const elapsed = Date.now() - t0
    expect(elapsed).toBeGreaterThanOrEqual(10)
    expect(adapter.isConnected).toBe(true)

    await adapter.disconnect()
  })

  it('smoke 4: WrappedWebSocket with disconnect rule', async () => {
    const injector = new FailureInjector(new SeededRandom(0))
    injector.addRule(new DisconnectRule('dc', FailureInjectionScope.PUBLIC_WS, 1.0))

    const factory = new ChaosWebSocketFactory(injector)
    const adapter = new BybitFeedAdapter(factory)

    await connectAndOpen(adapter)

    // Initially connected
    expect(adapter.isConnected).toBe(true)

    // The disconnect rule fires ~100ms after open
    await new Promise(r => setTimeout(r, 300))

    // Adapter should have detected the closure
    expect(adapter.isConnected).toBe(false)

    // Clean up — already disconnected, so this is a no-op
    await adapter.disconnect()
  })
})
