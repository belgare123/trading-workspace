/**
 * BybitFeedAdapter.test.ts — Bybit v5 public WebSocket market data adapter tests
 *
 * Covers state machine, WebSocket lifecycle, message parsing
 * for all 4 stream types, ping/pong, reconnect, event emit,
 * and symbol normalization.
 *
 * @since 4.9
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BybitFeedAdapter } from './BybitFeedAdapter'

// ── Mock WebSocket (class — must be constructable with `new`) ──

let lastWs: MockSocket | null = null
const instances: MockSocket[] = []

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
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>

  constructor(url: string) {
    this.url = url
    this.send = vi.fn()
    this.close = vi.fn(() => {
      this.readyState = MockSocket.CLOSED
      // Schedule close event asynchronously (like real WebSocket)
      setTimeout(() => this.onclose?.(null as any), 0)
    })
    instances.push(this)
    lastWs = this
  }
}

function freshMock() {
  instances.length = 0
  lastWs = null
  globalThis.WebSocket = MockSocket as any
}

function getWs(): MockSocket {
  if (!lastWs) throw new Error('No WebSocket instance created — did connect() get called?')
  return lastWs
}

function openWs() {
  getWs().onopen?.(null as any)
}

function closeWs(manual = false) {
  const ws = getWs()
  // If manual disconnect already cleaned up handlers, the onclose won't fire
  // So we invoke the handler if it's still set
  ws.onclose?.(null as any)
}

// ── Tests ──

describe('BybitFeedAdapter', () => {
  let adapter: BybitFeedAdapter

  beforeEach(() => {
    freshMock()
    adapter = new BybitFeedAdapter()
  })

  afterEach(() => {
    delete (globalThis as any).WebSocket
  })

  // ── Initial State ──

  it('starts in idle state', () => {
    expect(adapter.isConnected).toBe(false)
    expect((adapter as any)._state).toBe('idle')
  })

  it('has correct id', () => {
    expect(adapter.id).toBe('bybit')
  })

  // ── Event Listeners (on/off/emit) ──

  it('on/off emit — registers, fires, and unregisters listeners', () => {
    const handler = vi.fn()
    adapter.on('market:ticker', handler)
    ;(adapter as any).emit({ type: 'market:ticker', data: { symbol: 'BTCUSDT', price: 60000 } })
    expect(handler).toHaveBeenCalledTimes(1)

    adapter.off('market:ticker', handler)
    ;(adapter as any).emit({ type: 'market:ticker', data: {} })
    expect(handler).toHaveBeenCalledTimes(1) // no additional call
  })

  // ── Symbol normalization ──

  it('subscribe normalizes symbol to uppercase alphanumeric', async () => {
    // Manually set state to 'open' so subscribe doesn't try to reconnect
    const s = adapter as any
    s._state = 'open'
    s.ws = new MockSocket('ws://test')

    await adapter.subscribe('btc/usdt')
    expect(s.subscribedSymbols.has('BTCUSDT')).toBe(true)
  })

  it('unsubscribe removes symbol from tracking', async () => {
    const s = adapter as any
    s._state = 'open'
    s.ws = new MockSocket('ws://test')

    await adapter.subscribe('BTCUSDT')
    expect(s.subscribedSymbols.has('BTCUSDT')).toBe(true)
    await adapter.unsubscribe('BTCUSDT')
    expect(s.subscribedSymbols.has('BTCUSDT')).toBe(false)
  })

  // ── Connect / Disconnect Lifecycle ──

  it('connect creates WebSocket and transitions to open', async () => {
    const connectPromise = adapter.connect()
    expect(getWs()).toBeDefined()
    expect((adapter as any)._state).toBe('connecting')

    openWs()
    await connectPromise

    expect(adapter.isConnected).toBe(true)
    expect((adapter as any)._state).toBe('open')
  })

  it('connect is idempotent when already open', async () => {
    // Manually set state to open
    ;(adapter as any)._state = 'open'
    const wsBefore = (adapter as any).ws = { close: vi.fn(), readyState: MockSocket.OPEN }

    await adapter.connect() // should be no-op
    expect((adapter as any).ws).toBe(wsBefore) // no new ws created
  })

  it('disconnect closes WebSocket and cleans up', async () => {
    const connectPromise = adapter.connect()
    openWs()
    await connectPromise

    const ws = getWs()
    await adapter.disconnect()
    expect(ws.close).toHaveBeenCalled()
    expect(adapter.isConnected).toBe(false)
  })

  it('disconnect prevents reconnect on subsequent close', async () => {
    const cp = adapter.connect()
    openWs()
    await cp
    await adapter.disconnect()
    await new Promise(r => setTimeout(r, 10))
    expect((adapter as any).reconnectAttempt).toBe(0)
  })

  // ── Ping ──

  it('starts ping interval after connection', async () => {
    vi.useFakeTimers()
    const connectPromise = adapter.connect()
    openWs()
    await connectPromise

    vi.advanceTimersByTime(20000)
    expect(getWs().send).toHaveBeenCalledWith(JSON.stringify({ op: 'ping' }))
    vi.useRealTimers()
  })

  // ── Message Handling ──

  it('handleMessage ignores pong responses', () => {
    expect(() => (adapter as any).handleMessage(JSON.stringify({ op: 'pong' }))).not.toThrow()
  })

  it('handleMessage ignores subscribe success', () => {
    expect(() => (adapter as any).handleMessage(JSON.stringify({ op: 'subscribe', success: true })))
      .not.toThrow()
  })

  it('handleMessage does not crash on invalid JSON', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(adapter as any).handleMessage('not json')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  // ── Ticker Parsing ──

  it('emitTicker parses ticker data correctly', () => {
    const handler = vi.fn()
    adapter.on('market:ticker', handler)

    ;(adapter as any).emitTicker(
      { symbol: 'BTCUSDT', lastPrice: '60000.5', price24hPcnt: '0.025',
        volume24h: '1234.5', highPrice24h: '61000', lowPrice24h: '59000' },
      1000,
    )

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0][0]
    expect(event.type).toBe('market:ticker')
    expect(event.data.symbol).toBe('BTCUSDT')
    expect(event.data.price).toBe(60000.5)
    expect(event.data.change24h).toBe(0.025)
    expect(event.data.volume24h).toBe(1234.5)
  })

  it('emitTicker handles missing fields with zero', () => {
    const handler = vi.fn()
    adapter.on('market:ticker', handler)
    ;(adapter as any).emitTicker({ symbol: 'ETHUSDT' }, 1000)
    expect(handler.mock.calls[0][0].data.price).toBe(0)
    expect(handler.mock.calls[0][0].data.change24h).toBe(0)
  })

  // ── Trade Parsing ──

  it('emitTrades emits last trade from array', () => {
    const handler = vi.fn()
    adapter.on('market:trade', handler)

    ;(adapter as any).emitTrades({
      data: [
        { symbol: 'BTCUSDT', id: '1', price: '60000', size: '0.01', side: 'Buy', timestamp: 1000 },
        { symbol: 'BTCUSDT', id: '2', price: '60001', size: '0.02', side: 'Sell', timestamp: 1001 },
      ],
    }, 999)

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0][0]
    expect(event.data.symbol).toBe('BTCUSDT')
    expect(event.data.tradeId).toBe('2')
    expect(event.data.price).toBe(60001)
    expect(event.data.side).toBe('sell')
  })

  it('emitTrades does nothing when data is empty/not-array', () => {
    const handler = vi.fn()
    adapter.on('market:trade', handler)
    ;(adapter as any).emitTrades({ data: [] }, 1000)
    ;(adapter as any).emitTrades({ data: 'invalid' }, 1000)
    expect(handler).not.toHaveBeenCalled()
  })

  // ── Kline Parsing ──

  it('emitKline parses kline data correctly', () => {
    const handler = vi.fn()
    adapter.on('market:kline', handler)

    ;(adapter as any).emitKline({
      symbol: 'BTCUSDT', open: '30000', high: '31000', low: '29000',
      close: '30500', volume: '100.5', confirm: 'true', timestamp: 2000,
    }, 1000)

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0][0]
    expect(event.data.symbol).toBe('BTCUSDT')
    expect(event.data.open).toBe(30000)
    expect(event.data.close).toBe(30500)
    expect(event.data.volume).toBe(100.5)
    expect(event.data.closed).toBe(true)
  })

  it('emitKline correctly parses string confirm values (Bug #3 fix)', () => {
    const handler = vi.fn()
    adapter.on('market:kline', handler)

    // Bug #3 was: (data.confirm as boolean) ?? false
    // 'as boolean' is a type assertion (no-op at runtime), so string 'false' was truthy
    // Fix: data.confirm === 'true'
    ;(adapter as any).emitKline({
      symbol: 'BTCUSDT', open: '30000', high: '31000', low: '29000',
      close: '30500', volume: '100', confirm: 'true', timestamp: 2000,
    }, 1000)

    // confirm='true' → should be boolean true
    expect(handler.mock.calls[0][0].data.closed).toBe(true)

    // When confirm='false' string, should be boolean false
    ;(adapter as any).emitKline({
      symbol: 'BTCUSDT', open: '30000', high: '31000', low: '29000',
      close: '30500', volume: '100', confirm: 'false', timestamp: 2000,
    }, 1000)

    expect(handler.mock.calls[1][0].data.closed).toBe(false)
  })

  // ── OrderBook Parsing ──

  it('emitOrderBook parses orderbook snapshot correctly', () => {
    const handler = vi.fn()
    adapter.on('market:orderbook', handler)

    ;(adapter as any).emitOrderBook({
      symbol: 'BTCUSDT',
      b: [['30000', '1.5'], ['29990', '2.0']],
      a: [['30010', '0.5'], ['30020', '1.0']],
      u: 42,
    }, 1000)

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0][0]
    expect(event.data.bids.length).toBe(2)
    expect(event.data.bids[0].price).toBe(30000)
    expect(event.data.asks[0].price).toBe(30010)
    expect(event.data.firstUpdateId).toBe(42)
  })

  it('emitOrderBook handles null/undefined bid/ask arrays', () => {
    const handler = vi.fn()
    adapter.on('market:orderbook', handler)
    ;(adapter as any).emitOrderBook({ symbol: 'BTCUSDT', b: null, a: undefined, u: 0 }, 1000)
    expect(handler.mock.calls[0][0].data.bids).toEqual([])
    expect(handler.mock.calls[0][0].data.asks).toEqual([])
  })

  // ── Topic routing ──

  it('routes ticker topic to emitTicker', () => {
    const spy = vi.spyOn(adapter as any, 'emitTicker')
    ;(adapter as any).handleTopicData({ topic: 'tickers.BTCUSDT', data: { symbol: 'BTCUSDT' }, ts: 1000 })
    expect(spy).toHaveBeenCalledWith({ symbol: 'BTCUSDT' }, 1000)
    spy.mockRestore()
  })

  it('routes publicTrade topic to emitTrades', () => {
    const spy = vi.spyOn(adapter as any, 'emitTrades')
    ;(adapter as any).handleTopicData({ topic: 'publicTrade.BTCUSDT', data: { data: [] }, ts: 1000 })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('routes kline topic to emitKline', () => {
    const spy = vi.spyOn(adapter as any, 'emitKline')
    ;(adapter as any).handleTopicData({ topic: 'kline.1.BTCUSDT', data: { symbol: 'BTCUSDT' }, ts: 1000 })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('routes orderbook topic to emitOrderBook', () => {
    const spy = vi.spyOn(adapter as any, 'emitOrderBook')
    ;(adapter as any).handleTopicData({ topic: 'orderbook.25.BTCUSDT', data: { symbol: 'BTCUSDT' }, ts: 1000 })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  // ── Subscribe sends WS messages ──

  it('subscribe sends subscribe message on open WebSocket', async () => {
    const s = adapter as any
    s._state = 'open'
    s.ws = new MockSocket('ws://test')

    await adapter.subscribe('BTCUSDT')

    const sent = getWs().send.mock.calls
    const subCall = sent.find((c: string[]) => {
      try { return JSON.parse(c[0]).op === 'subscribe' } catch { return false }
    })
    expect(subCall).toBeDefined()
    const parsed = JSON.parse(subCall[0])
    expect(parsed.args).toContain('tickers.BTCUSDT')
    expect(parsed.args).toContain('publicTrade.BTCUSDT')
    expect(parsed.args).toContain('kline.1.BTCUSDT')
    expect(parsed.args).toContain('orderbook.25.BTCUSDT')
  })

  it('unsubscribe sends unsubscribe message', async () => {
    const s = adapter as any
    s._state = 'open'
    s.ws = new MockSocket('ws://test')
    s.subscribedSymbols.set('BTCUSDT', new Set(['ticker']))

    await adapter.unsubscribe('BTCUSDT')

    const sent = getWs().send.mock.calls
    const unsubCall = sent.find((c: string[]) => {
      try { return JSON.parse(c[0]).op === 'unsubscribe' } catch { return false }
    })
    expect(unsubCall).toBeDefined()
  })

  // ── send guards ──

  it('send does nothing when ws is null', () => {
    expect(() => (adapter as any).send({ test: true })).not.toThrow()
  })

  it('send does nothing when ws is not open', () => {
    const s = adapter as any
    const fakeWs = { readyState: MockSocket.CONNECTING, send: vi.fn() }
    s.ws = fakeWs
    s.send({ test: true })
    expect(fakeWs.send).not.toHaveBeenCalled()
  })

  // ── resubscribeAll ──

  it('resubscribeAll sends subscription for all tracked symbols', () => {
    const s = adapter as any
    s.subscribedSymbols.set('BTCUSDT', new Set(['ticker', 'trade', 'kline', 'orderbook']))
    s.subscribedSymbols.set('ETHUSDT', new Set(['ticker']))
    s._state = 'open'
    s.ws = new MockSocket('ws://test')

    s.resubscribeAll()

    const sent = JSON.parse(getWs().send.mock.calls[0][0])
    expect(sent.op).toBe('subscribe')
    expect(sent.args).toContain('tickers.ETHUSDT')
    expect(sent.args.length).toBe(5) // 4 for BTC + 1 for ETH
  })
})
