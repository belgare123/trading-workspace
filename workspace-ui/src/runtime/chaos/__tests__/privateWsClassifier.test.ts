/**
 * privateWsClassifier.test.ts — Unit tests for Bybit Private WS message classifier
 */

import { describe, it, expect } from 'vitest'
import { createBybitCategoryClassifier } from '../privateWsClassifier'
import { FailureInjectionScope } from '../InjectionRule'

describe('createBybitCategoryClassifier', () => {
  const classifier = createBybitCategoryClassifier()

  it('classifies order topic to PRIVATE_WS_ORDER', () => {
    const scope = classifier({ type: 'snapshot', topic: 'order', data: [{ orderId: '1' }] })
    expect(scope).toBe(FailureInjectionScope.PRIVATE_WS_ORDER)
  })

  it('classifies execution topic to PRIVATE_WS_EXECUTION', () => {
    const scope = classifier({ type: 'delta', topic: 'execution', data: [{ execId: 'e1' }] })
    expect(scope).toBe(FailureInjectionScope.PRIVATE_WS_EXECUTION)
  })

  it('classifies position topic to PRIVATE_WS_POSITION', () => {
    const scope = classifier({ type: 'snapshot', topic: 'position', data: [{ symbol: 'XRPUSDT' }] })
    expect(scope).toBe(FailureInjectionScope.PRIVATE_WS_POSITION)
  })

  it('classifies wallet topic to PRIVATE_WS_WALLET', () => {
    const scope = classifier({ type: 'delta', topic: 'wallet', data: [{ coin: 'USDT' }] })
    expect(scope).toBe(FailureInjectionScope.PRIVATE_WS_WALLET)
  })

  it('classifies account topic to PRIVATE_WS_ACCOUNT', () => {
    const scope = classifier({ type: 'snapshot', topic: 'account', data: [{ accountType: 'UNIFIED' }] })
    expect(scope).toBe(FailureInjectionScope.PRIVATE_WS_ACCOUNT)
  })

  it('falls back to PRIVATE_WS umbrella for auth messages', () => {
    const scope = classifier({ op: 'auth', success: true, retMsg: 'OK' })
    expect(scope).toBe(FailureInjectionScope.PRIVATE_WS)
  })

  it('falls back to PRIVATE_WS umbrella for ping/pong', () => {
    const scope = classifier({ op: 'pong' })
    expect(scope).toBe(FailureInjectionScope.PRIVATE_WS)
  })

  it('falls back to PRIVATE_WS umbrella for subscription responses', () => {
    const scope = classifier({ op: 'subscribe', success: true, retMsg: 'OK' })
    expect(scope).toBe(FailureInjectionScope.PRIVATE_WS)
  })

  it('falls back to PRIVATE_WS umbrella for unknown topics', () => {
    const scope = classifier({ type: 'snapshot', topic: 'unknown_topic', data: [] })
    expect(scope).toBe(FailureInjectionScope.PRIVATE_WS)
  })

  it('falls back to PRIVATE_WS umbrella for empty message', () => {
    const scope = classifier({})
    expect(scope).toBe(FailureInjectionScope.PRIVATE_WS)
  })

  it('falls back to PRIVATE_WS umbrella for null/invalid input', () => {
    // This tests the JSON.parse path — the raw string gets parsed by WrappedWebSocket,
    // but if somehow a non-object reaches the classifier, it should be safe
    const scope = classifier('not-an-object')
    expect(scope).toBe(FailureInjectionScope.PRIVATE_WS)
  })
})
