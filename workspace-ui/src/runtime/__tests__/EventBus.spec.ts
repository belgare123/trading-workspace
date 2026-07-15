/**
 * EventBus Specification Tests — type-level + runtime
 *
 * Проверяет, что EventBus v2 соблюдает спецификацию Sprint 2.4.2:
 * - RuntimeEvent<T> канонический формат
 * - Typed emit/on
 * - Middleware pipeline
 * - Event Registry
 * - Event Recorder
 *
 * @since 2.0.0
 */

import { EventBus, loggingMiddleware, metricsMiddleware } from '../EventBus'
import { EventRegistry } from '../EventRegistry'
import { createEvent, isRuntimeEvent, type RuntimeEvent } from '../RuntimeEvent'
import { RT } from '../RuntimeEvents'

// ═════════════════════════════════════════════════════════════════════
//  1. RuntimeEvent<T> — создание
// ═════════════════════════════════════════════════════════════════════

const event = createEvent('market.tick', { symbol: 'BTCUSDT', price: 50000 }, {
  source: 'MarketService',
  severity: 'info',
})

// Type check
type AssertPayload = typeof event.payload extends { symbol: string; price: number } ? true : false
const _payloadCheck: AssertPayload = true

// Проверка isRuntimeEvent
if (!isRuntimeEvent(event)) throw new Error('[FAIL] isRuntimeEvent should return true')

// Проверка полей
if (!event.id) throw new Error('[FAIL] event.id should be set')
if (event.topic !== 'market.tick') throw new Error(`[FAIL] topic mismatch: ${event.topic}`)
if (event.source !== 'MarketService') throw new Error(`[FAIL] source mismatch: ${event.source}`)
if (event.version !== 1) throw new Error(`[FAIL] version mismatch: ${event.version}`)
if (event.severity !== 'info') throw new Error(`[FAIL] severity mismatch: ${event.severity}`)

console.log('[PASS] RuntimeEvent<T> — create + validate')

// ═════════════════════════════════════════════════════════════════════
//  2. Typed EventBus — emit / on
// ═════════════════════════════════════════════════════════════════════

const bus = new EventBus({ historyLimit: 10 })

let received: RuntimeEvent<{ symbol: string; price: number }> | null = null

bus.on<{ symbol: string; price: number }>('market.tick', (evt) => {
  received = evt
})

bus.emit('market.tick', { symbol: 'ETHUSDT', price: 3000 }, { source: 'Test' })

if (!received) throw new Error('[FAIL] Event not received')
if (received.payload.symbol !== 'ETHUSDT') throw new Error(`[FAIL] payload mismatch: ${received.payload.symbol}`)

console.log('[PASS] Typed emit/on — basic')

// ═════════════════════════════════════════════════════════════════════
//  3. Wildcard subscription
// ═════════════════════════════════════════════════════════════════════

let wildcardReceived = 0
bus.on('market.*', () => { wildcardReceived++ })
bus.emit('market.tick', { symbol: 'XRPUSDT', price: 0.5 }, { source: 'Test' })
bus.emit('market.price', { symbol: 'XRPUSDT', price: 0.51 }, { source: 'Test' })

if (wildcardReceived !== 2) throw new Error(`[FAIL] Expected 2 wildcard events, got ${wildcardReceived}`)

console.log('[PASS] Wildcard subscription — market.*')

// ═════════════════════════════════════════════════════════════════════
//  4. catch-all ('*')
// ═════════════════════════════════════════════════════════════════════

let allReceived = 0
bus.on('*', () => { allReceived++ })

bus.emit('test.event', { foo: 'bar' }, { source: 'Test' })

if (allReceived < 1) throw new Error('[FAIL] Catch-all not received')

console.log('[PASS] Catch-all subscription — *')

// ═════════════════════════════════════════════════════════════════════
//  5. Middleware pipeline
// ═════════════════════════════════════════════════════════════════════

const middlewareBus = new EventBus()
let mwOrder: string[] = []

middlewareBus.use((evt, next) => {
  mwOrder.push('mw1')
  next()
})

middlewareBus.use((evt, next) => {
  mwOrder.push('mw2')
  next()
})

middlewareBus.emit('test.mw', { msg: 'hello' }, { source: 'Test' })

if (mwOrder[0] !== 'mw1' || mwOrder[1] !== 'mw2') {
  throw new Error(`[FAIL] Middleware order: ${mwOrder.join(', ')}`)
}

console.log('[PASS] Middleware pipeline order')

// ═════════════════════════════════════════════════════════════════════
//  6. correlationId / causationId
// ═════════════════════════════════════════════════════════════════════

const traceBus = new EventBus()
let traceReceived: RuntimeEvent | null = null

traceBus.on('order.created', (evt) => { traceReceived = evt })

traceBus.emit('order.created', { id: 'ord-123' }, {
  source: 'OrderService',
  correlationId: 'ctx-456',
  causationId: 'signal-789',
})

if (traceReceived?.correlationId !== 'ctx-456') throw new Error('[FAIL] correlationId mismatch')
if (traceReceived?.causationId !== 'signal-789') throw new Error('[FAIL] causationId mismatch')

console.log('[PASS] correlationId / causationId')

// ═════════════════════════════════════════════════════════════════════
//  7. Event Registry
// ═════════════════════════════════════════════════════════════════════

const marketSchema = EventRegistry.get('market.tick')
if (!marketSchema) throw new Error('[FAIL] market.tick not registered')
if (marketSchema.source !== 'MarketService') throw new Error('[FAIL] schema source mismatch')

const allSchemas = EventRegistry.getAll()
if (allSchemas.length < 20) throw new Error(`[FAIL] Too few schemas: ${allSchemas.length}`)

const pluginSchemas = EventRegistry.getByNamespace('plugin')
if (pluginSchemas.length < 3) throw new Error(`[FAIL] Too few plugin schemas: ${pluginSchemas.length}`)

console.log('[PASS] Event Registry — schemas registered')

// ═════════════════════════════════════════════════════════════════════
//  8. Built-in middleware
// ═════════════════════════════════════════════════════════════════════

metricsMiddleware.reset()
const metricBus = new EventBus()
metricBus.use(metricsMiddleware)

metricBus.emit('market.tick', { symbol: 'BTC' }, { source: 'Test' })
metricBus.emit('market.tick', { symbol: 'ETH' }, { source: 'Test' })
metricBus.emit('strategy.signal', { id: 's1' }, { source: 'Test' })

if (metricsMiddleware.counters['market.tick'] !== 2) throw new Error('[FAIL] metrics counter')
if (metricsMiddleware.total !== 3) throw new Error('[FAIL] metrics total')

console.log('[PASS] Built-in middleware — metrics')

// ═════════════════════════════════════════════════════════════════════
//  9. History
// ═════════════════════════════════════════════════════════════════════

bus.emit('test.history', { n: 1 }, { source: 'Test' })
bus.emit('test.history', { n: 2 }, { source: 'Test' })

const history = bus.history()
if (history.length < 5) throw new Error(`[FAIL] History too short: ${history.length}`)

console.log('[PASS] Event history')

// ═════════════════════════════════════════════════════════════════════
//  10. once
// ═════════════════════════════════════════════════════════════════════

let onceCount = 0
bus.once('test.once', () => { onceCount++ })
bus.emit('test.once', { n: 1 }, { source: 'Test' })
bus.emit('test.once', { n: 2 }, { source: 'Test' })

if (onceCount !== 1) throw new Error(`[FAIL] once called ${onceCount} times`)

console.log('[PASS] once subscription')

// ═════════════════════════════════════════════════════════════════════
//  All tests passed
// ═════════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════')
console.log('All EventBus Specification tests PASSED')
console.log('═══════════════════════════════════════')
