// __tests__/EventEnvelope.test.ts

import { describe, it, expect } from 'vitest'
import { createEventEnvelope } from '../EventEnvelope'
import type { EventEnvelope } from '../EventEnvelope'

describe('createEventEnvelope', () => {
  it('creates an envelope with required fields', () => {
    const env = createEventEnvelope({
      traceId: 'trace-1',
      runtime: 'trade',
      type: 'TradeOpened',
      payload: { symbol: 'XRPUSDT', qty: 10 },
    }) as EventEnvelope

    expect(env.id).toBeDefined()
    expect(typeof env.id).toBe('string')
    expect(env.id.length).toBeGreaterThan(30) // UUID
    expect(env.traceId).toBe('trace-1')
    expect(env.runtime).toBe('trade')
    expect(env.type).toBe('TradeOpened')
    expect(env.payload).toEqual({ symbol: 'XRPUSDT', qty: 10 })
  })

  it('sets sequence to 0 as placeholder', () => {
    const env = createEventEnvelope({
      traceId: 'trace-1',
      runtime: 'system',
      type: 'Test',
      payload: {},
    }) as EventEnvelope

    expect(env.sequence).toBe(0)
  })

  it('sets timestamp to current time', () => {
    const before = Date.now()
    const env = createEventEnvelope({
      traceId: 't',
      runtime: 'system',
      type: 'Test',
      payload: {},
    }) as EventEnvelope
    const after = Date.now()

    expect(env.timestamp).toBeGreaterThanOrEqual(before)
    expect(env.timestamp).toBeLessThanOrEqual(after)
  })

  it('defaults metadata version and schemaVersion to 1', () => {
    const env = createEventEnvelope({
      traceId: 't',
      runtime: 'system',
      type: 'Test',
      payload: {},
    }) as EventEnvelope

    expect(env.metadata.version).toBe(1)
    expect(env.metadata.schemaVersion).toBe(1)
    expect(env.metadata.source).toBe('workspace-ui:2.0.0')
  })

  it('allows overriding metadata', () => {
    const env = createEventEnvelope({
      traceId: 't',
      runtime: 'system',
      type: 'Test',
      payload: {},
      source: 'test:v1',
      metadata: { schemaVersion: 2 },
    }) as EventEnvelope

    expect(env.metadata.version).toBe(1) // default
    expect(env.metadata.schemaVersion).toBe(2)
    expect(env.metadata.source).toBe('test:v1')
  })

  it('includes optional fields when provided', () => {
    const env = createEventEnvelope({
      traceId: 'trace-1',
      causationId: 'cause-1',
      correlationId: 'corr-1',
      tradeId: 'trade-1',
      runtime: 'trade',
      type: 'OrderFilled',
      payload: { orderId: 'ord-1' },
    }) as EventEnvelope

    expect(env.causationId).toBe('cause-1')
    expect(env.correlationId).toBe('corr-1')
    expect(env.tradeId).toBe('trade-1')
  })

  it('does not include optional fields when omitted', () => {
    const env = createEventEnvelope({
      traceId: 't',
      runtime: 'system',
      type: 'Test',
      payload: {},
    }) as EventEnvelope

    expect(env.causationId).toBeUndefined()
    expect(env.correlationId).toBeUndefined()
    expect(env.tradeId).toBeUndefined()
  })

  it('generates unique IDs for consecutive calls', () => {
    const a = createEventEnvelope({ traceId: 't', runtime: 'system', type: 'A', payload: {} })
    const b = createEventEnvelope({ traceId: 't', runtime: 'system', type: 'B', payload: {} })

    expect((a as EventEnvelope).id).not.toBe((b as EventEnvelope).id)
  })
})
