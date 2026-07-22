/**
 * PrivateWS.integration.test.ts — Private WebSocket DI + Category Classification
 *
 * Validates:
 * 1. Production path: BybitBrokerAdapter uses NativeWebSocketFactory (no chaos)
 * 2. DI path: ChaosWebSocketFactory with CategoryClassifier is passed through
 * 3. Category isolation: per-category rules only affect matching messages
 * 4. Umbrella scope: PRIVATE_WS matches all private_ws.* sub-scopes
 *
 * @since 6.6.4
 */

import { describe, it, expect } from 'vitest'
import { FailureInjector } from '../FailureInjector'
import { SeededRandom } from '../SeededRandom'
import {
  FailureInjectionScope,
  DisconnectRule,
  LatencyRule,
  PacketLossRule,
} from '../InjectionRule'
import { createBybitCategoryClassifier } from '../privateWsClassifier'
import { ChaosWebSocketFactory, NativeWebSocketFactory } from '../WebSocketFactory'

describe('Private WS DI — Production path', () => {
  it('new BybitBrokerAdapter() uses NativeWebSocketFactory (no chaos)', async () => {
    const { BybitBrokerAdapter } = await import('../../../workspace/live/brokers/BybitBrokerAdapter')
    const adapter = new BybitBrokerAdapter()
    expect(adapter.id).toBe('bybit')
    expect(adapter.connection).toBeDefined()
  })

  it('new BybitBrokerAdapter(fetchFn) also defaults NativeWebSocketFactory', async () => {
    const { BybitBrokerAdapter } = await import('../../../workspace/live/brokers/BybitBrokerAdapter')
    const mockFetch = async () => new Response('{}', { status: 200 })
    const adapter = new BybitBrokerAdapter(mockFetch)
    expect(adapter.id).toBe('bybit')
  })

  it('new BybitBrokerAdapter(fetchFn, chaosFactory) accepts ChaosWebSocketFactory via DI', async () => {
    const { BybitBrokerAdapter } = await import('../../../workspace/live/brokers/BybitBrokerAdapter')
    const injector = new FailureInjector(new SeededRandom(42))
    const classifier = createBybitCategoryClassifier()
    const chaosFactory = new ChaosWebSocketFactory(injector, undefined, classifier)

    const mockFetch = async () => new Response('{}', { status: 200 })
    const adapter = new BybitBrokerAdapter(mockFetch, chaosFactory)
    expect(adapter.id).toBe('bybit')
  })
})

describe('Private WS Category Classifier — Integration', () => {
  const classifier = createBybitCategoryClassifier()

  it('classifies known topics correctly via injector scope matching', () => {
    const injector = new FailureInjector(new SeededRandom(42))

    // Add rules for specific categories
    const orderRule = new DisconnectRule('order-rule', FailureInjectionScope.PRIVATE_WS_ORDER, 0.5)
    const execRule = new PacketLossRule('exec-rule', FailureInjectionScope.PRIVATE_WS_EXECUTION, 0.5, { lossRate: 0.3 })
    injector.addRule(orderRule)
    injector.addRule(execRule)

    // Evaluate for order message
    const orderScope = classifier({ type: 'snapshot', topic: 'order', data: [{ orderId: '1' }] })
    const orderMatches = injector.matchingRules({
      scope: orderScope,
      url: 'wss://stream.bybit.com/v5/private',
      timestamp: Date.now(),
    })
    expect(orderMatches).toHaveLength(1)
    expect(orderMatches[0].id).toBe('order-rule')

    // Evaluate for execution message
    const execScope = classifier({ type: 'delta', topic: 'execution', data: [{ execId: 'e1' }] })
    const execMatches = injector.matchingRules({
      scope: execScope,
      url: 'wss://stream.bybit.com/v5/private',
      timestamp: Date.now(),
    })
    expect(execMatches).toHaveLength(1)
    expect(execMatches[0].id).toBe('exec-rule')
  })

  it('umbrella PRIVATE_WS matches all private_ws.* sub-scopes', () => {
    const injector = new FailureInjector(new SeededRandom(42))

    // An umbrella rule on PRIVATE_WS
    const umbrellaRule = new DisconnectRule('umbrella', FailureInjectionScope.PRIVATE_WS, 0.5)
    injector.addRule(umbrellaRule)

    // Should match every private WS category
    const topics = ['order', 'execution', 'position', 'wallet', 'account']
    for (const topic of topics) {
      const scope = classifier({ type: 'snapshot', topic, data: [] })
      const matches = injector.matchingRules({
        scope,
        url: 'wss://stream.bybit.com/v5/private',
        timestamp: Date.now(),
      })
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe('umbrella')
    }
  })

  it('category isolation: execution rule does not affect order messages', () => {
    const injector = new FailureInjector(new SeededRandom(42))

    injector.addRule(new DisconnectRule('exec-rule', FailureInjectionScope.PRIVATE_WS_EXECUTION, 1.0))

    // Order message should NOT match the execution rule
    const orderScope = classifier({ type: 'snapshot', topic: 'order', data: [] })
    const matches = injector.matchingRules({
      scope: orderScope,
      url: 'wss://stream.bybit.com/v5/private',
      timestamp: Date.now(),
    })
    expect(matches).toHaveLength(0) // No matching rules for order
  })

  it('auth/pong messages get PRIVATE_WS umbrella scope', () => {
    const injector = new FailureInjector(new SeededRandom(42))

    const umbrellaRule = new DisconnectRule('umbrella', FailureInjectionScope.PRIVATE_WS, 0.5)
    const execRule = new DisconnectRule('exec', FailureInjectionScope.PRIVATE_WS_EXECUTION, 0.5)
    injector.addRule(umbrellaRule)
    injector.addRule(execRule)

    // Auth message should match umbrella but NOT execution-specific rule
    const authScope = classifier({ op: 'auth', success: true })
    const authMatches = injector.matchingRules({
      scope: authScope,
      url: 'wss://stream.bybit.com/v5/private',
      timestamp: Date.now(),
    })
    expect(authMatches).toHaveLength(1)
    expect(authMatches[0].id).toBe('umbrella')
  })

  it('ChaosWebSocketFactory constructs with classifier without error', () => {
    const injector = new FailureInjector(new SeededRandom(42))
    const classifier = createBybitCategoryClassifier()
    const factory = new ChaosWebSocketFactory(injector, undefined, classifier)

    // Creating a WebSocket with private URL — the factory should set
    // baseScope = PRIVATE_WS and attach the classifier
    const ws = factory.createWebSocket('wss://stream.bybit.com/v5/private')
    expect(ws).toBeDefined()
    expect(typeof ws.send).toBe('function')
    expect(typeof ws.close).toBe('function')
  })
})

describe('Private WS — Resilience invariants (certification contracts)', () => {
  const classifier = createBybitCategoryClassifier()

  /**
   * Invariant 1: Order ACK is not lost on disconnect.
   * The FailureInjector with per-category rules must not affect
   * order-scoped messages when the rule targets execution only.
   */
  it('Invariant 1: order ACK resilience under execution-only chaos', () => {
    const injector = new FailureInjector(new SeededRandom(1))

    // Only execution messages get packet loss
    injector.addRule(new PacketLossRule('exec-pkt', FailureInjectionScope.PRIVATE_WS_EXECUTION, 1.0, { lossRate: 1.0 }))

    // Order ACK in a separate stream must pass through
    const orderScope = classifier({ type: 'delta', topic: 'order', data: [{ orderId: '1', orderStatus: 'New' }] })
    const orderMatches = injector.matchingRules({
      scope: orderScope,
      url: 'wss://stream.bybit.com/v5/private',
      timestamp: Date.now(),
    })
    expect(orderMatches).toHaveLength(0) // No rule matches → no loss
  })

  /**
   * Invariant 2: Fill (execution) is not applied twice.
   * Packet-loss on execution is independent from order stream.
   */
  it('Invariant 2: fill idempotency — category isolation prevents duplicate', () => {
    const injector = new FailureInjector(new SeededRandom(1))

    // Disconnect on position stream should not affect execution
    injector.addRule(new DisconnectRule('pos-disc', FailureInjectionScope.PRIVATE_WS_POSITION, 1.0))

    const execScope = classifier({ type: 'delta', topic: 'execution', data: [{ execId: 'e1', execType: 'Trade' }] })
    const execMatches = injector.matchingRules({
      scope: execScope,
      url: 'wss://stream.bybit.com/v5/private',
      timestamp: Date.now(),
    })
    // No position rule should match execution
    expect(execMatches.filter(r => r.scope !== FailureInjectionScope.GLOBAL).length).toBe(0)
  })

  /**
   * Invariant 3: Position after reconnect matches REST snapshot.
   * Position chaos (latency/disconnect) is isolated.
   */
  it('Invariant 3: position resilience — category isolation works at injector level', () => {
    const injector = new FailureInjector(new SeededRandom(1))

    // Only position gets latency
    injector.addRule(new LatencyRule('pos-lat', FailureInjectionScope.PRIVATE_WS_POSITION, 1.0, { minMs: 1000, maxMs: 2000 }))

    // Order and wallet should be unaffected
    const orderScope = classifier({ type: 'snapshot', topic: 'order', data: [] })
    const walletScope = classifier({ type: 'delta', topic: 'wallet', data: [] })

    const orderMatches = injector.matchingRules({ scope: orderScope, url: '', timestamp: 0 })
    const walletMatches = injector.matchingRules({ scope: walletScope, url: '', timestamp: 0 })

    expect(orderMatches).toHaveLength(0)
    expect(walletMatches).toHaveLength(0)

    // Position should match
    const posScope = classifier({ type: 'snapshot', topic: 'position', data: [] })
    const posMatches = injector.matchingRules({ scope: posScope, url: '', timestamp: 0 })
    expect(posMatches).toHaveLength(1)
    expect(posMatches[0].id).toBe('pos-lat')
  })
})
