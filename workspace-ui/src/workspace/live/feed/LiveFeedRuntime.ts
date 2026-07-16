/**
 * LiveFeedRuntime.ts — Facade for the Market Data Layer
 *
 * LiveFeedRuntime is the single entry point for all market data.
 * It manages feed adapters, subscriptions, caches, and event routing.
 *
 * Consumers (StrategyRuntime, PaperProvider, Chart Studio) subscribe
 * to typed market events and never deal with exchange connections directly.
 *
 * @since 4.2
 */

import type { FeedAdapter } from '../adapters/FeedAdapter'
import { MarketEventBus } from './MarketEventBus'
import { SubscriptionManager } from './SubscriptionManager'
import { FeedRegistry } from './FeedRegistry'
import { SymbolRegistry } from './SymbolRegistry'
import { FeedStatistics } from './FeedStatistics'

export class LiveFeedRuntime {
  readonly bus: MarketEventBus
  readonly subscriptions: SubscriptionManager
  readonly registry: FeedRegistry
  readonly symbols: SymbolRegistry
  readonly stats: FeedStatistics

  private tickInterval: ReturnType<typeof setInterval> | null = null
  private started = false

  constructor() {
    this.bus = new MarketEventBus()
    this.subscriptions = new SubscriptionManager()
    this.registry = new FeedRegistry()
    this.symbols = new SymbolRegistry()
    this.stats = new FeedStatistics()
  }

  // ── Lifecycle ──

  /** Start the feed runtime */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true

    // Tick stats every 10s
    this.tickInterval = setInterval(() => this.stats.tick(), 10_000)

    console.log('[LiveFeedRuntime] Started')
  }

  /** Stop the feed runtime */
  async stop(): Promise<void> {
    if (!this.started) return

    // Unsubscribe all
    await this.subscriptions.unsubscribeAll()

    // Disconnect all adapters
    for (const adapter of this.registry.list()) {
      await adapter.disconnect()
    }

    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }

    this.bus.clear()
    this.started = false

    console.log('[LiveFeedRuntime] Stopped')
  }

  // ── Adapter Management ──

  /** Register and connect a feed adapter */
  async useAdapter(adapter: FeedAdapter): Promise<void> {
    this.registry.register(adapter)
    this.subscriptions.registerAdapter(adapter)
    this.stats.registerAdapter(adapter.id)

    // Forward adapter events to the bus
    const eventTypes: Array<Parameters<typeof adapter.on>[0]> = [
      'market:connected',
      'market:disconnected',
      'market:ticker',
      'market:trade',
      'market:kline',
      'market:orderbook',
      'market:error',
      'market:reconnect',
      'market:latency',
    ]

    const handler = (event: any) => {
      this.bus.emit(event)
    }

    for (const t of eventTypes) {
      adapter.on(t, handler)
    }

    await adapter.connect()
    this.stats.recordConnected(adapter.id)
    this.registry.setActive(adapter.id)
  }

  /** Remove a feed adapter */
  async removeAdapter(adapterId: string): Promise<void> {
    const adapter = this.registry.get(adapterId)
    if (adapter) {
      await adapter.disconnect()
      this.stats.recordDisconnected(adapterId)
    }
    this.registry.unregister(adapterId)
    this.subscriptions.unregisterAdapter(adapterId)
    this.stats.unregister(adapterId)
  }

  /** Get the active adapter */
  getActiveAdapter(): FeedAdapter | undefined {
    return this.registry.getActive()
  }

  // ── Subscriptions ──

  /** Subscribe to a symbol */
  async subscribe(symbol: string): Promise<void> {
    // Register in symbol registry if not present
    if (!this.symbols.has(symbol)) {
      this.symbols.register({
        symbol: symbol.toUpperCase(),
        baseAsset: symbol.split('/')[0] || symbol,
        quoteAsset: symbol.split('/')[1] || 'USDT',
        priceDecimals: 2,
        quantityDecimals: 4,
        minNotional: 10,
        minQuantity: 0.001,
        status: 'active',
      })
    }

    await this.subscriptions.subscribe(symbol)
  }

  /** Unsubscribe from a symbol */
  async unsubscribe(symbol: string): Promise<void> {
    await this.subscriptions.unsubscribe(symbol)
  }

  /** List active subscriptions */
  getActiveSubscriptions(): string[] {
    return this.subscriptions.getActiveSymbols()
  }

  // ── Status ──

  /** Check if the runtime is running */
  isRunning(): boolean {
    return this.started
  }

  /** Get runtime health summary */
  getHealth(): Record<string, unknown> {
    return {
      running: this.started,
      adapters: this.registry.size,
      activeAdapter: this.registry.getActive()?.id ?? null,
      symbols: this.symbols.size,
      activeSubscriptions: this.subscriptions.activeCount,
      adapterStats: this.stats.getAll(),
    }
  }
}
