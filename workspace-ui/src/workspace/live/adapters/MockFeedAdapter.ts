/**
 * MockFeedAdapter.ts — Simulated market data feed for development/testing
 *
 * Generates realistic-looking market data without an exchange connection.
 * Useful for UI development, offline testing, and demos.
 *
 * @since 4.2
 */

import type { FeedAdapter, Listener } from './FeedAdapter'
import type {
  MarketEvent,
  TickerEvent,
  TradeEvent,
  KlineEvent,
} from '../types'

interface MockConfig {
  symbols?: string[]
  tickIntervalMs?: number
  tradeIntervalMs?: number
  klineIntervalMs?: number
  initialPrice?: number
}

export class MockFeedAdapter implements FeedAdapter {
  readonly id = 'mock'

  private listeners = new Map<string, Set<Listener>>()
  private ticks: Record<string, { price: number; volume: number }> = {}
  private intervals: ReturnType<typeof setInterval>[] = []
  private connected = false

  private config: Required<MockConfig>

  constructor(config?: MockConfig) {
    this.config = {
      symbols: config?.symbols ?? ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
      tickIntervalMs: config?.tickIntervalMs ?? 1_000,
      tradeIntervalMs: config?.tradeIntervalMs ?? 500,
      klineIntervalMs: config?.klineIntervalMs ?? 5_000,
      initialPrice: config?.initialPrice ?? 50000,
    }

    for (const symbol of this.config.symbols) {
      this.ticks[symbol] = {
        price: this.config.initialPrice * (1 + Math.random() * 0.5),
        volume: Math.random() * 1000 + 100,
      }
    }
  }

  async connect(): Promise<void> {
    this.connected = true
    this.emit({ type: 'market:connected', adapterId: this.id, timestamp: Date.now() })

    // Start generating data
    this.startTickers()
    this.startTrades()
    this.startKlines()

    console.log(`[MockFeedAdapter] Connected with ${this.config.symbols.length} symbols`)
  }

  async disconnect(): Promise<void> {
    this.connected = false
    for (const interval of this.intervals) {
      clearInterval(interval)
    }
    this.intervals = []
    this.emit({ type: 'market:disconnected', adapterId: this.id, timestamp: Date.now() })
    console.log('[MockFeedAdapter] Disconnected')
  }

  async subscribe(_symbol: string): Promise<void> {
    // Mock: all symbols are always available
  }

  async unsubscribe(_symbol: string): Promise<void> {
    // Mock: no-op
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
      try { handler(event) } catch { /* ignore handler errors */ }
    }
  }

  private randomWalk(current: number, volatility = 0.001): number {
    return current * (1 + (Math.random() - 0.5) * volatility * 2)
  }

  private startTickers(): void {
    const interval = setInterval(() => {
      if (!this.connected) return
      for (const symbol of this.config.symbols) {
        const tick = this.ticks[symbol]
        tick.price = this.randomWalk(tick.price, 0.002)
        tick.volume += Math.random() * 10

        const event: TickerEvent = {
          symbol,
          price: tick.price,
          change24h: (Math.random() - 0.5) * 5,
          volume24h: tick.volume,
          high24h: tick.price * 1.02,
          low24h: tick.price * 0.98,
          timestamp: Date.now(),
        }
        this.emit({ type: 'market:ticker', data: event })
      }
    }, this.config.tickIntervalMs)
    this.intervals.push(interval)
  }

  private startTrades(): void {
    const interval = setInterval(() => {
      if (!this.connected) return
      for (const symbol of this.config.symbols) {
        const tick = this.ticks[symbol]
        const trade: TradeEvent = {
          symbol,
          tradeId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          price: this.randomWalk(tick.price, 0.001),
          quantity: Math.random() * 2 + 0.01,
          side: Math.random() > 0.5 ? 'buy' : 'sell',
          timestamp: Date.now(),
        }
        this.emit({ type: 'market:trade', data: trade })
      }
    }, this.config.tradeIntervalMs)
    this.intervals.push(interval)
  }

  private startKlines(): void {
    const interval = setInterval(() => {
      if (!this.connected) return
      for (const symbol of this.config.symbols) {
        const tick = this.ticks[symbol]
        const open = tick.price
        const close = this.randomWalk(open, 0.003)
        const high = Math.max(open, close) * (1 + Math.random() * 0.002)
        const low = Math.min(open, close) * (1 - Math.random() * 0.002)

        const kline: KlineEvent = {
          symbol,
          interval: '1m',
          open,
          high,
          low,
          close,
          volume: Math.random() * 100 + 10,
          timestamp: Date.now(),
          closed: true,
        }
        this.emit({ type: 'market:kline', data: kline })
      }
    }, this.config.klineIntervalMs)
    this.intervals.push(interval)
  }
}
