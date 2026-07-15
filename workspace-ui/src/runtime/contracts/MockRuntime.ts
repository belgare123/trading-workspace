/**
 * MockRuntime — эталонная реализация Runtime Contract
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Проходит все контрактные тесты (Sprint 2.4.3).
 * Используется для:
 * - Разработки UI без бэкенда
 * - Валидации контрактных тестов
 * - Пример для реализации REST/WS/Sim/Cloud Runtime
 *
 * Реализует:
 * - MarketRuntimeContract
 * - ReplayRuntimeContract
 * - PluginRuntimeContract
 * - PortfolioRuntimeContract
 * - StrategyRuntimeContract
 * - MLRuntimeContract
 * - SearchRuntimeContract
 * - EventStoreRuntimeContract
 * - NotificationRuntimeContract
 */

import type {
  MarketRuntimeContract,
  ReplayRuntimeContract,
  PluginRuntimeContract,
  PortfolioRuntimeContract,
  StrategyRuntimeContract,
  MLRuntimeContract,
  SearchRuntimeContract,
  EventStoreRuntimeContract,
  NotificationRuntimeContract,
  RuntimeEvent,
} from './RuntimeContract'

// ═════════════════════════════════════════════════════════════════════
//  Helpers
// ═════════════════════════════════════════════════════════════════════

function makeEvent(topic: string, payload: unknown, overrides?: Partial<RuntimeEvent>): RuntimeEvent {
  return {
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    topic,
    source: 'MockRuntime',
    severity: 'info',
    version: 1,
    payload,
    ...overrides,
  } as RuntimeEvent
}

type EventCb = (event: RuntimeEvent) => void
let _mockIdCounter = 0

// ═════════════════════════════════════════════════════════════════════
//  Mock Market Runtime
// ═════════════════════════════════════════════════════════════════════

export class MockMarketRuntime implements MarketRuntimeContract {
  readonly id = `mock-market-${++_mockIdCounter}`
  private _subscribers = new Set<EventCb>()
  private _interval: ReturnType<typeof setInterval> | null = null
  private _subscribedSymbols: string[] = []

  async symbols(): Promise<string[]> {
    return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT']
  }

  async subscribe(symbols: string[]): Promise<void> {
    this._subscribedSymbols = symbols
    if (symbols.length > 0 && !this._interval) {
      this._interval = setInterval(() => {
        for (const sym of symbols) {
          this._emit(makeEvent('market.tick', {
            symbol: sym,
            price: 100 + Math.random() * 50,
            volume: Math.random() * 1000,
            change: (Math.random() - 0.5) * 2,
          }))
        }
      }, 500)
    }
  }

  async unsubscribe(symbols: string[]): Promise<void> {
    this._subscribedSymbols = this._subscribedSymbols.filter((s) => !symbols.includes(s))
    if (this._subscribedSymbols.length === 0 && this._interval) {
      clearInterval(this._interval)
      this._interval = null
    }
  }

  async orderBook(symbol: string, _depth?: number): Promise<{ bids: [number, number][]; asks: [number, number][] }> {
    const gen = (): [number, number][] =>
      Array.from({ length: 10 }, (_, i) => [100 - i * 0.5 + Math.random(), Math.random() * 10] as [number, number])
    return { bids: gen(), asks: gen() }
  }

  async candles(symbol: string, _interval?: string, _limit?: number): Promise<{ time: number; open: number; high: number; low: number; close: number; volume: number }[]> {
    return Array.from({ length: 20 }, (_, i) => ({
      time: Date.now() - (20 - i) * 60_000,
      open: 100 + Math.random() * 10,
      high: 105 + Math.random() * 10,
      low: 95 + Math.random() * 10,
      close: 100 + Math.random() * 10,
      volume: Math.random() * 10000,
    }))
  }

  async health(): Promise<{ ok: boolean; latency: number }> {
    return { ok: true, latency: Math.random() * 50 }
  }

  onEvent(cb: EventCb): () => void {
    this._subscribers.add(cb)
    return () => this._subscribers.delete(cb)
  }

  private _emit(event: RuntimeEvent): void {
    this._subscribers.forEach((cb) => cb(event))
  }
}

// ═════════════════════════════════════════════════════════════════════
//  Mock Replay Runtime
// ═════════════════════════════════════════════════════════════════════

export class MockReplayRuntime implements ReplayRuntimeContract {
  readonly id = `mock-replay-${++_mockIdCounter}`
  private _state: 'idle' | 'playing' | 'paused' = 'idle'
  private _subscribers = new Set<EventCb>()
  private _current = 0
  private _total = 0
  private _speed = 1
  private _events: RuntimeEvent[] = []

  async play(speed?: number): Promise<void> {
    this._state = 'playing'
    this._speed = speed ?? 1
    this._emit(makeEvent('replay.play', { speed: this._speed }))
  }

  async pause(): Promise<void> {
    this._state = 'paused'
    this._emit(makeEvent('replay.pause', {}))
  }

  async seek(timestamp: number): Promise<void> {
    this._current = timestamp
    this._emit(makeEvent('replay.seek', { timestamp }))
  }

  async state(): Promise<'idle' | 'playing' | 'paused'> {
    return this._state
  }

  async load(events: RuntimeEvent[]): Promise<void> {
    this._events = events
    this._total = events.length
    this._current = 0
    this._state = 'idle'
  }

  async progress(): Promise<{ current: number; total: number; speed: number }> {
    return { current: this._current, total: this._total, speed: this._speed }
  }

  onEvent(cb: EventCb): () => void {
    this._subscribers.add(cb)
    return () => this._subscribers.delete(cb)
  }

  private _emit(event: RuntimeEvent): void {
    this._subscribers.forEach((cb) => cb(event))
  }
}

// ═════════════════════════════════════════════════════════════════════
//  Mock Plugin Runtime
// ═════════════════════════════════════════════════════════════════════

export class MockPluginRuntime implements PluginRuntimeContract {
  readonly id = `mock-plugin-${++_mockIdCounter}`
  private _plugins = new Map([
    ['hello-world', { id: 'hello-world', state: 'ready', version: '1.0.0', manifest: { name: 'Hello World', description: 'Demo plugin', author: 'Runtime', permissions: [] } }],
    ['market-heatmap', { id: 'market-heatmap', state: 'ready', version: '1.2.0', manifest: { name: 'Market Heatmap', description: 'Market overview heatmap', author: 'Runtime', permissions: ['market.read'] } }],
    ['telegram', { id: 'telegram', state: 'activated', version: '0.9.0', manifest: { name: 'Telegram Notifications', description: 'Send alerts to Telegram', author: 'Runtime', permissions: ['notification.write'] } }],
  ])
  private _subscribers = new Set<EventCb>()

  async list(): Promise<{ id: string; state: string; version: string }[]> {
    return Array.from(this._plugins.values()).map((p) => ({ id: p.id, state: p.state, version: p.version }))
  }

  async info(id: string): Promise<{ manifest: unknown; state: string }> {
    const p = this._plugins.get(id)
    if (!p) throw new Error(`Plugin '${id}' not found`)
    return { manifest: p.manifest, state: p.state }
  }

  onEvent(cb: EventCb): () => void {
    this._subscribers.add(cb)
    return () => this._subscribers.delete(cb)
  }
}

// ═════════════════════════════════════════════════════════════════════
//  Mock Portfolio Runtime
// ═════════════════════════════════════════════════════════════════════

export class MockPortfolioRuntime implements PortfolioRuntimeContract {
  readonly id = `mock-portfolio-${++_mockIdCounter}`
  private _subscribers = new Set<EventCb>()

  async balance(asset?: string): Promise<{ asset: string; free: number; locked: number; total: number }[]> {
    const all = [
      { asset: 'BTC', free: 0.5, locked: 0.1, total: 0.6 },
      { asset: 'ETH', free: 10.0, locked: 2.0, total: 12.0 },
      { asset: 'USDT', free: 25000, locked: 5000, total: 30000 },
    ]
    if (asset) return all.filter((b) => b.asset === asset)
    return all
  }

  async positions(): Promise<{ symbol: string; side: 'long' | 'short'; size: number; entryPrice: number; currentPrice: number; pnl: number }[]> {
    return [
      { symbol: 'BTCUSDT', side: 'long', size: 0.1, entryPrice: 42300, currentPrice: 43500, pnl: 120 },
      { symbol: 'ETHUSDT', side: 'short', size: 2.0, entryPrice: 2300, currentPrice: 2250, pnl: 100 },
    ]
  }

  onEvent(cb: EventCb): () => void {
    this._subscribers.add(cb)
    return () => this._subscribers.delete(cb)
  }
}

// ═════════════════════════════════════════════════════════════════════
//  Mock Strategy Runtime
// ═════════════════════════════════════════════════════════════════════

export class MockStrategyRuntime implements StrategyRuntimeContract {
  readonly id = `mock-strategy-${++_mockIdCounter}`
  private _strategies = new Map([
    ['ema-cross', { id: 'ema-cross', name: 'EMA Cross', status: 'running', metrics: { sharpe: 1.45, winRate: 62, trades: 147 } }],
    ['bb-reversal', { id: 'bb-reversal', name: 'BB Reversal', status: 'paused', metrics: { sharpe: 0.89, winRate: 55, trades: 89 } }],
    ['ml-regression', { id: 'ml-regression', name: 'ML Regression', status: 'running', metrics: { sharpe: 2.1, winRate: 68, trades: 234 } }],
  ])
  private _subscribers = new Set<EventCb>()

  async list(): Promise<{ id: string; name: string; status: string; metrics: Record<string, number> }[]> {
    return Array.from(this._strategies.values())
  }

  async start(id: string, _params?: Record<string, unknown>): Promise<void> {
    const s = this._strategies.get(id)
    if (!s) throw new Error(`Strategy '${id}' not found`)
    s.status = 'running'
    this._emit(makeEvent('strategy.started', { id }))
  }

  async stop(id: string): Promise<void> {
    const s = this._strategies.get(id)
    if (!s) throw new Error(`Strategy '${id}' not found`)
    s.status = 'stopped'
    this._emit(makeEvent('strategy.stopped', { id }))
  }

  async metrics(id: string): Promise<Record<string, number>> {
    const s = this._strategies.get(id)
    if (!s) throw new Error(`Strategy '${id}' not found`)
    return s.metrics
  }

  onEvent(cb: EventCb): () => void {
    this._subscribers.add(cb)
    return () => this._subscribers.delete(cb)
  }

  private _emit(event: RuntimeEvent): void {
    this._subscribers.forEach((cb) => cb(event))
  }
}

// ═════════════════════════════════════════════════════════════════════
//  Mock ML Runtime
// ═════════════════════════════════════════════════════════════════════

export class MockMLRuntime implements MLRuntimeContract {
  readonly id = `mock-ml-${++_mockIdCounter}`
  private _models = [
    { id: 'price-prediction', name: 'Price Prediction LSTM', version: '2.1.0', status: 'active' },
    { id: 'volatility-forecast', name: 'Volatility Forecast', version: '1.3.0', status: 'active' },
    { id: 'sentiment-analysis', name: 'Sentiment Analysis', version: '0.8.0', status: 'training' },
  ]
  private _subscribers = new Set<EventCb>()

  async list(): Promise<{ id: string; name: string; version: string; status: string }[]> {
    return this._models
  }

  async predict(modelId: string, _features: number[]): Promise<{ prediction: number; confidence: number }> {
    const model = this._models.find((m) => m.id === modelId)
    if (!model) throw new Error(`Model '${modelId}' not found`)
    return { prediction: 100 + Math.random() * 50, confidence: 0.7 + Math.random() * 0.25 }
  }

  onEvent(cb: EventCb): () => void {
    this._subscribers.add(cb)
    return () => this._subscribers.delete(cb)
  }
}

// ═════════════════════════════════════════════════════════════════════
//  Mock Search Runtime
// ═════════════════════════════════════════════════════════════════════

export class MockSearchRuntime implements SearchRuntimeContract {
  readonly id = `mock-search-${++_mockIdCounter}`
  private _items = [
    { title: 'BTCUSDT Market Data', description: 'Current price and volume for BTCUSDT', type: 'market', url: '/market/BTCUSDT' },
    { title: 'EMA Cross Strategy', description: 'Exponential Moving Average crossover trading strategy', type: 'strategy', url: '/strategies/ema-cross' },
    { title: 'Portfolio Overview', description: 'Current portfolio balance and positions', type: 'portfolio', url: '/portfolio' },
    { title: 'Plugin: Telegram Notifications', description: 'Send trading alerts to Telegram', type: 'plugin', url: '/plugins/telegram' },
    { title: 'ML Price Prediction', description: 'LSTM-based price prediction model', type: 'ml', url: '/ml/price-prediction' },
  ]

  async search(query: string, _limit?: number): Promise<{ results: { title: string; description: string; type: string; url: string }[]; total: number }> {
    const q = query.toLowerCase()
    const results = this._items.filter(
      (i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
    )
    return { results, total: results.length }
  }

  onEvent(cb: EventCb): () => void {
    return () => {} // no events for search
  }
}

// ═════════════════════════════════════════════════════════════════════
//  Mock EventStore Runtime
// ═════════════════════════════════════════════════════════════════════

export class MockEventStoreRuntime implements EventStoreRuntimeContract {
  readonly id = `mock-eventstore-${++_mockIdCounter}`
  private _events: RuntimeEvent[] = []

  async store(event: RuntimeEvent): Promise<void> {
    this._events.push(event)
  }

  async query(filter: { topic?: string; source?: string; from?: number; to?: number; limit?: number }): Promise<RuntimeEvent[]> {
    let result = this._events
    if (filter.topic) result = result.filter((e) => e.topic === filter.topic)
    if (filter.source) result = result.filter((e) => e.source === filter.source)
    if (filter.from) result = result.filter((e) => e.timestamp >= filter.from!)
    if (filter.to) result = result.filter((e) => e.timestamp <= filter.to!)
    if (filter.limit) result = result.slice(-filter.limit)
    return result
  }

  onEvent(cb: EventCb): () => void {
    return () => {}
  }
}

// ═════════════════════════════════════════════════════════════════════
//  Mock Notification Runtime
// ═════════════════════════════════════════════════════════════════════

export class MockNotificationRuntime implements NotificationRuntimeContract {
  readonly id = `mock-notification-${++_mockIdCounter}`
  private _history: { id: string; title: string; message: string; level: string; timestamp: number }[] = []

  async send(notification: { title: string; message: string; level?: 'info' | 'warn' | 'error' }): Promise<{ id: string }> {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this._history.push({
      id,
      title: notification.title,
      message: notification.message,
      level: notification.level ?? 'info',
      timestamp: Date.now(),
    })
    return { id }
  }

  async history(_limit?: number): Promise<{ id: string; title: string; message: string; level: string; timestamp: number }[]> {
    return [...this._history].reverse()
  }

  onEvent(cb: EventCb): () => void {
    return () => {}
  }
}

// ═════════════════════════════════════════════════════════════════════
//  Full MockRuntime
// ═════════════════════════════════════════════════════════════════════

import type { RuntimeContract } from './RuntimeContract'

export class MockRuntime implements RuntimeContract {
  readonly market = new MockMarketRuntime()
  readonly replay = new MockReplayRuntime()
  readonly plugin = new MockPluginRuntime()
  readonly portfolio = new MockPortfolioRuntime()
  readonly strategy = new MockStrategyRuntime()
  readonly ml = new MockMLRuntime()
  readonly search = new MockSearchRuntime()
  readonly eventStore = new MockEventStoreRuntime()
  readonly notification = new MockNotificationRuntime()

  async init(): Promise<void> {
    // Nothing to initialise
  }

  async destroy(): Promise<void> {
    // Nothing to clean up
  }
}
