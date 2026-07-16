/**
 * BinanceFeedAdapter.ts — Binance WebSocket market data adapter
 *
 * Connects to Binance WebSocket streams and normalizes
 * raw exchange data into typed MarketEvents.
 *
 * Streams used:
 * - <symbol>@ticker      — 24hr ticker
 * - <symbol>@trade       — real-time trades
 * - <symbol>@kline_1m    — 1-minute klines
 * - <symbol>@depth20@100ms — 20-level order book
 *
 * @since 4.2
 */

import type { FeedAdapter, Listener } from './FeedAdapter'
import type {
  MarketEvent,
  TickerEvent,
  TradeEvent,
  KlineEvent,
  OrderBookEvent,
  KlineInterval,
} from '../types'

export class BinanceFeedAdapter implements FeedAdapter {
  readonly id = 'binance'

  private listeners = new Map<string, Set<Listener>>()
  private ws: WebSocket | null = null
  private subscribedSymbols = new Set<string>()
  private reconnectAttempt = 0
  private readonly MAX_RECONNECT_ATTEMPTS = 10
  private readonly RECONNECT_DELAY_MS = 2_000
  private baseUrl = 'wss://stream.binance.com:9443/ws'

  private pingInterval: ReturnType<typeof setInterval> | null = null

  constructor(baseUrl?: string) {
    if (baseUrl) this.baseUrl = baseUrl
  }

  async connect(): Promise<void> {
    this.emit({ type: 'market:connected', adapterId: this.id, timestamp: Date.now() })
    console.log('[BinanceFeedAdapter] Connected (lazy — WS opens on first subscribe)')
  }

  async disconnect(): Promise<void> {
    this.closeWebSocket()
    this.emit({ type: 'market:disconnected', adapterId: this.id, timestamp: Date.now() })
    console.log('[BinanceFeedAdapter] Disconnected')
  }

  async subscribe(symbol: string): Promise<void> {
    const normalized = symbol.replace('/', '').toLowerCase()
    this.subscribedSymbols.add(normalized)
    await this.ensureWebSocket()
  }

  async unsubscribe(symbol: string): Promise<void> {
    const normalized = symbol.replace('/', '').toLowerCase()
    this.subscribedSymbols.delete(normalized)

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        method: 'UNSUBSCRIBE',
        params: [
          `${normalized}@ticker`,
          `${normalized}@trade`,
          `${normalized}@kline_1m`,
          `${normalized}@depth20@100ms`,
        ],
        id: Date.now(),
      })
    }
  }

  on(event: string, handler: Listener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: Listener): void {
    this.listeners.get(event)?.delete(handler)
  }

  // ── Private ──

  private emit(event: MarketEvent): void {
    const handlers = this.listeners.get(event.type)
    if (!handlers) return
    for (const handler of handlers) {
      try { handler(event) } catch { /* silent */ }
    }
  }

  private async ensureWebSocket(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return

    const streams = Array.from(this.subscribedSymbols)
      .flatMap(s => [
        `${s}@ticker`,
        `${s}@trade`,
        `${s}@kline_1m`,
        `${s}@depth20@100ms`,
      ])

    if (streams.length === 0) return

    const url = `${this.baseUrl}/${streams.join('/')}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.reconnectAttempt = 0
      console.log(`[BinanceFeedAdapter] WS opened: ${streams.length} streams`)

      // Ping every 3 minutes to keep alive
      this.pingInterval = setInterval(() => {
        this.send({ method: 'ping', id: Date.now() })
      }, 180_000)
    }

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data)
    }

    this.ws.onerror = (err: Event) => {
      console.error('[BinanceFeedAdapter] WS error:', err)
      this.emit({
        type: 'market:error',
        data: { code: 'WS_ERROR', message: 'WebSocket error', timestamp: Date.now() },
      })
    }

    this.ws.onclose = () => {
      this.cleanupPing()
      this.emit({
        type: 'market:disconnected',
        adapterId: this.id,
        timestamp: Date.now(),
      })
      this.attemptReconnect()
    }
  }

  private handleMessage(data: string): void {
    try {
      const json = JSON.parse(data)

      // Handle pong
      if (json.pong) return

      const streamType = this.detectStreamType(json)
      if (!streamType) return

      switch (streamType) {
        case 'ticker':
          this.emitTicker(json)
          break
        case 'trade':
          this.emitTrade(json)
          break
        case 'kline':
          this.emitKline(json)
          break
        case 'depth':
          this.emitOrderBook(json)
          break
      }
    } catch (err) {
      console.warn('[BinanceFeedAdapter] Failed to parse message:', err)
    }
  }

  private detectStreamType(json: Record<string, unknown>): string | null {
    if (json.e === '24hrTicker') return 'ticker'
    if (json.e === 'trade') return 'trade'
    if (json.e === 'kline') return 'kline'
    if (json.e === 'depthUpdate' || json.lastUpdateId) return 'depth'
    return null
  }

  private emitTicker(json: any): void {
    const event: TickerEvent = {
      symbol: json.s,
      price: parseFloat(json.c),
      change24h: parseFloat(json.p),
      volume24h: parseFloat(json.v),
      high24h: parseFloat(json.h),
      low24h: parseFloat(json.l),
      timestamp: json.E,
    }
    this.emit({ type: 'market:ticker', data: event })
  }

  private emitTrade(json: any): void {
    const event: TradeEvent = {
      symbol: json.s,
      tradeId: json.t.toString(),
      price: parseFloat(json.p),
      quantity: parseFloat(json.q),
      side: json.m ? 'sell' : 'buy',
      timestamp: json.T,
    }
    this.emit({ type: 'market:trade', data: event })
  }

  private emitKline(json: any): void {
    const k = json.k
    const event: KlineEvent = {
      symbol: json.s,
      interval: k.i as KlineInterval,
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
      timestamp: k.t,
      closed: k.x,
    }
    this.emit({ type: 'market:kline', data: event })
  }

  private emitOrderBook(json: any): void {
    const event: OrderBookEvent = {
      symbol: json.s,
      bids: (json.b ?? []).map(([price, qty]: string[]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
      asks: (json.a ?? []).map(([price, qty]: string[]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
      firstUpdateId: json.U ?? 0,
      lastUpdateId: json.u ?? 0,
      timestamp: json.E ?? Date.now(),
    }
    this.emit({ type: 'market:orderbook', data: event })
  }

  private send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  private closeWebSocket(): void {
    this.cleanupPing()
    if (this.ws) {
      this.ws.onclose = null // prevent reconnect
      this.ws.close()
      this.ws = null
    }
  }

  private cleanupPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempt >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[BinanceFeedAdapter] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempt++
    const delay = this.RECONNECT_DELAY_MS * Math.pow(1.5, this.reconnectAttempt - 1)

    console.log(`[BinanceFeedAdapter] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`)
    this.emit({
      type: 'market:reconnect',
      adapterId: this.id,
      attempt: this.reconnectAttempt,
      timestamp: Date.now(),
    })

    setTimeout(() => {
      this.ensureWebSocket()
      this.emit({ type: 'market:connected', adapterId: this.id, timestamp: Date.now() })
    }, delay)
  }
}
