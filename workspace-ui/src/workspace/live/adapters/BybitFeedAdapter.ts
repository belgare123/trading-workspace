/**
 * BybitFeedAdapter.ts — Bybit v5 public WebSocket market data adapter
 *
 * Connects to Bybit v5 public WebSocket (USDT Perpetual / Linear).
 * Normalises raw Bybit data into typed MarketEvents for LiveFeedRuntime.
 *
 * Streams used:
 * - tickers.{symbol}      — 24hr ticker
 * - publicTrade.{symbol}  — real-time trades
 * - kline.{symbol}.1m     — 1-minute klines
 * - orderbook.{symbol}.25 — 25-level order book
 *
 * No API keys required — public endpoints only.
 *
 * Bybit v5 WS API: https://bybit-exchange.github.io/docs/v5/ws/connect
 *
 * @since 4.9
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
import type { IWebSocketFactory } from '../../../runtime/chaos/WebSocketFactory'
import { NativeWebSocketFactory } from '../../../runtime/chaos/WebSocketFactory'

interface BybitWsMessage {
  topic: string
  type: 'snapshot' | 'delta'
  ts: number
  data: unknown
}

const BYBIT_WS_URL = 'wss://stream.bybit.com/v5/public/linear'

type WsState = 'idle' | 'connecting' | 'open' | 'closing' | 'closed'

export class BybitFeedAdapter implements FeedAdapter {
  readonly id = 'bybit'

  private listeners = new Map<string, Set<Listener>>()
  private ws: WebSocket | null = null
  private subscribedSymbols = new Map<string, Set<string>>() // symbol → stream types
  private reconnectAttempt = 0
  private readonly MAX_RECONNECT_ATTEMPTS = 20
  private readonly RECONNECT_BASE_DELAY_MS = 1_000
  private readonly RECONNECT_MAX_DELAY_MS = 30_000

  private pingInterval: ReturnType<typeof setInterval> | null = null
  private subscribedTopics = new Set<string>()
  private baseUrl: string

  // Connection state machine
  private _state: WsState = 'idle'
  private connectResolve: (() => void) | null = null
  private connectReject: ((err: Error) => void) | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private manualDisconnect = false
  private wsFactory: IWebSocketFactory

  get isConnected(): boolean {
    return this._state === 'open'
  }

  constructor(factory?: IWebSocketFactory, baseUrl?: string) {
    this.wsFactory = factory ?? new NativeWebSocketFactory()
    this.baseUrl = baseUrl ?? BYBIT_WS_URL
  }

  async connect(): Promise<void> {
    if (this._state === 'open') return

    // Wait for actual WS connection
    return new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve
      this.connectReject = reject
      this.ensureWebSocket()
    })
  }

  async disconnect(): Promise<void> {
    this.manualDisconnect = true
    this.cancelReconnect()
    this.closeWebSocket()
    this.emit({ type: 'market:disconnected', adapterId: this.id, timestamp: Date.now() })
    console.log('[BybitFeedAdapter] Disconnected')
  }

  async subscribe(symbol: string): Promise<void> {
    const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const types = this.subscribedSymbols.get(normalized) ?? new Set<string>()
    types.add('ticker').add('trade').add('kline').add('orderbook')
    this.subscribedSymbols.set(normalized, types)

    // Auto-reconnect if WebSocket was disconnected (e.g. by cert scenarios)
    if (this._state !== 'open') {
      this.manualDisconnect = false
      await this.connect()
    }

    // Resend pending / new subscriptions
    await this.resubscribeAll()
  }

  async unsubscribe(symbol: string): Promise<void> {
    const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
    this.subscribedSymbols.delete(normalized)
    this.tryUnsubscribeTopic(normalized)
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
      try { handler(event) } catch { /* guard */ }
    }
  }

  private async ensureWebSocket(): Promise<void> {
    if (this._state === 'connecting' || this._state === 'open') return

    this._state = 'connecting'

    const ws = this.wsFactory.createWebSocket(this.baseUrl)
    this.ws = ws as unknown as WebSocket

    ws.onopen = () => {
      if (ws !== this.ws) return // stale connection
      this._state = 'open'
      this.reconnectAttempt = 0
      this.manualDisconnect = false
      console.log('[BybitFeedAdapter] WS connected')

      // Resolve pending connect() promise
      this.connectResolve?.()
      this.connectResolve = null
      this.connectReject = null

      // Subscribe to all collected symbols
      this.resubscribeAll()

      // Bybit requires ping every 20s (send pong on ping too)
      this.pingInterval = setInterval(() => {
        this.send({ op: 'ping' })
      }, 20_000)
    }

    ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data)
    }

    ws.onerror = (_err: Event) => {
      // Don't log individual errors — the close event will handle reconnect
      // WS errors are usually followed by onclose
    }

    ws.onclose = () => {
      if (ws !== this.ws) return // stale connection
      this.handleDisconnect()
    }
  }

  private handleDisconnect(): void {
    this.cleanupPing()
    this._state = 'closed'
    this.ws = null

    this.emit({
      type: 'market:disconnected',
      adapterId: this.id,
      timestamp: Date.now(),
    })

    // Reject pending connect() promise
    if (this.connectReject) {
      this.connectReject(new Error('WebSocket connection failed'))
      this.connectResolve = null
      this.connectReject = null
    }

    if (!this.manualDisconnect) {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[BybitFeedAdapter] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempt++
    const delay = Math.min(
      this.RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempt - 1),
      this.RECONNECT_MAX_DELAY_MS,
    )
    // Add jitter: ±20%
    const jitter = delay * 0.2 * (Math.random() * 2 - 1)
    const totalDelay = Math.round(delay + jitter)

    console.log(`[BybitFeedAdapter] Reconnecting in ${totalDelay}ms (attempt ${this.reconnectAttempt}/${this.MAX_RECONNECT_ATTEMPTS})`)
    this.emit({
      type: 'market:reconnect',
      adapterId: this.id,
      attempt: this.reconnectAttempt,
      timestamp: Date.now(),
    })

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this._state = 'idle'
      this.ensureWebSocket()
    }, totalDelay)
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempt = 0
  }

  private resubscribeAll(): void {
    const topics: string[] = []
    for (const [symbol, types] of this.subscribedSymbols.entries()) {
      if (types.has('ticker')) topics.push(`tickers.${symbol}`)
      if (types.has('trade')) topics.push(`publicTrade.${symbol}`)
      if (types.has('kline')) topics.push(`kline.1.${symbol}`)
      if (types.has('orderbook')) topics.push(`orderbook.50.${symbol}`)
    }

    if (topics.length > 0 && this._state === 'open') {
      this.send({
        op: 'subscribe',
        args: topics,
      })
      topics.forEach((t) => this.subscribedTopics.add(t))
    }
  }

  private async sendSubscription(symbol: string, types: Set<string>): Promise<void> {
    const topics: string[] = []
    if (types.has('ticker')) topics.push(`tickers.${symbol}`)
    if (types.has('trade')) topics.push(`publicTrade.${symbol}`)
    if (types.has('kline')) topics.push(`kline.1.${symbol}`)
    if (types.has('orderbook')) topics.push(`orderbook.25.${symbol}`)

    if (topics.length > 0) {
      this.send({
        op: 'subscribe',
        args: topics,
      })
      topics.forEach((t) => this.subscribedTopics.add(t))
    }
  }

  private tryUnsubscribeTopic(symbol: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const topics = [
        `tickers.${symbol}`,
        `publicTrade.${symbol}`,
        `kline.1.${symbol}`,
        `orderbook.25.${symbol}`,
      ]
      this.send({
        op: 'unsubscribe',
        args: topics,
      })
      topics.forEach((t) => this.subscribedTopics.delete(t))
    }
  }

  private handleMessage(data: string): void {
    try {
      const json = JSON.parse(data)

      // Handle pong (response to our ping)
      if (json.op === 'pong') return

      // Handle incoming ping from server — MUST respond with pong or Bybit disconnects
      if (json.op === 'ping') {
        this.send({ op: 'pong' })
        return
      }

      // Handle subscription response
      if (json.op === 'subscribe' && json.success === true) {
        console.log(`[BybitFeedAdapter] Subscribed to ${(json.args as string[])?.join(', ') || 'topics'}`)
        return
      }

      // Handle topic data
      if (json.topic && json.data) {
        this.handleTopicData(json)
      }
    } catch (err) {
      console.warn('[BybitFeedAdapter] Failed to parse message:', err)
    }
  }

  private handleTopicData(json: Record<string, unknown>): void {
    const topic = json.topic as string
    const data = json.data as Record<string, unknown>
    const timestamp = (json.ts as number) ?? Date.now()

    if (topic.startsWith('tickers.')) {
      this.emitTicker(data, timestamp)
    } else if (topic.startsWith('publicTrade.')) {
      this.emitTrades(data, timestamp)
    } else if (topic.startsWith('kline.')) {
      // Extract symbol from topic: "kline.1.BTCUSDT" → "BTCUSDT"
      const symbol = topic.split('.').pop() ?? ''
      this.emitKline(data, timestamp, symbol)
    } else if (topic.startsWith('orderbook.25.') || topic.startsWith('orderbook.50.')) {
      this.emitOrderBook(data, timestamp)
    }
  }

  private emitTicker(data: Record<string, unknown>, timestamp: number): void {
    const event: TickerEvent = {
      symbol: data.symbol as string,
      price: parseFloat((data.lastPrice as string) ?? '0'),
      change24h: parseFloat((data.price24hPcnt as string) ?? '0'),
      volume24h: parseFloat((data.volume24h as string) ?? '0'),
      high24h: parseFloat((data.highPrice24h as string) ?? '0'),
      low24h: parseFloat((data.lowPrice24h as string) ?? '0'),
      timestamp,
    }
    this.emit({ type: 'market:ticker', data: event })
  }

  private emitTrades(data: Record<string, unknown>, timestamp: number): void {
    // Bybit v5 returns trade data as an array [{...}]
    const trades = Array.isArray(data) ? data : data.data as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(trades) || trades.length === 0) return

    // Emit last trade only (the most recent)
    const t = trades[trades.length - 1] as Record<string, unknown>
    const event: TradeEvent = {
      symbol: (t.s ?? t.symbol) as string,
      tradeId: String(t.i ?? t.id ?? ''),
      price: parseFloat(((t.p ?? t.price) as string) ?? '0'),
      quantity: parseFloat((t.size as string) ?? '0'),
      side: (t.S as string) === 'Sell' ? 'sell' : (t.side as string) === 'Sell' ? 'sell' : 'buy',
      timestamp: (t.T ?? t.timestamp) as number ?? timestamp,
    }
    this.emit({ type: 'market:trade', data: event })
  }

  private emitKline(data: Record<string, unknown>, timestamp: number, symbolOverride?: string): void {
    // Bybit v5 returns kline data as an array [{...}]; symbol is NOT in the data, only in the topic
    const k = Array.isArray(data) ? (data[0] as Record<string, unknown>) ?? {} : data
    const event: KlineEvent = {
      symbol: symbolOverride ?? (k.symbol as string),
      interval: '1m' as KlineInterval,
      open: parseFloat((k.open as string) ?? '0'),
      high: parseFloat((k.high as string) ?? '0'),
      low: parseFloat((k.low as string) ?? '0'),
      close: parseFloat((k.close as string) ?? '0'),
      volume: parseFloat((k.volume as string) ?? '0'),
      timestamp: (k.timestamp as number) ?? timestamp,
      closed: k.confirm === 'true',
    }
    this.emit({ type: 'market:kline', data: event })
  }

  private emitOrderBook(data: Record<string, unknown>, timestamp: number): void {
    const convert = (entries: unknown): Array<{ price: number; quantity: number }> => {
      if (!Array.isArray(entries)) return []
      return entries.map((e: unknown) => {
        const entry = e as [string, string]
        return { price: parseFloat(entry[0]), quantity: parseFloat(entry[1]) }
      })
    }

    const event: OrderBookEvent = {
      symbol: data.symbol as string,
      bids: convert(data.b),
      asks: convert(data.a),
      firstUpdateId: (data.u as number) ?? 0,
      lastUpdateId: (data.u as number) ?? 0,
      timestamp,
    }
    this.emit({ type: 'market:orderbook', data: event })
  }

  private send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  private closeWebSocket(): void {
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this._state = 'closed'
  }

  private cleanupPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }
}
