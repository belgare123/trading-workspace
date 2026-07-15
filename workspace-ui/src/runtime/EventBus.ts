/**
 * EventBus v2 — Типизированная событийная шина Runtime
 *
 * @since 2.0.0
 * @version 2.0.0
 *
 * Архитектура:
 *   Producer → createEvent → validate → middleware → EventBus → subscribers → archive
 *
 * Фичи:
 * - Типизированный emit<T>() / on<T>()
 * - Middleware pipeline (Express-style)
 * - Поддержка RuntimeEvent<T> как канонического формата
 * - correlationId / causationId для трассировки
 * - Event Registry для валидации и документации
 * - Event lifecycle: created → validated → middleware → dispatched → completed
 */

import type { RuntimeEvent, EventLifecycleStage, EventStatus } from './RuntimeEvent'
import { createEvent, emptyEvent } from './RuntimeEvent'
import { EventRegistry } from './EventRegistry'
import type { EventSeverity } from './api'

// ─── Types ──────────────────────────────────────────────────────────

/** Handler — подписчик на события */
type EventHandler<T = unknown> = (event: RuntimeEvent<T>) => void

/** Middleware — Express-style: (event, next) => void */
type EventMiddleware = (event: RuntimeEvent, next: () => void) => void

/** Unsubscribe function */
type Unsubscribe = () => void

/** Event lifecycle callback */
type LifecycleListener = (event: RuntimeEvent, status: EventStatus) => void

/** Subscription filter */
interface SubscriptionFilter {
  topics?: (string | RegExp)[]
  sources?: string[]
  severity?: EventSeverity
}

// ─── EventBus ───────────────────────────────────────────────────────

export class EventBus {
  // ── Private state ──
  private _handlers = new Map<string, Set<EventHandler>>()
  private _onceHandlers = new Map<string, Set<EventHandler>>()
  private _wildcardHandlers = new Map<string, Set<EventHandler>>()
  private _filters = new Map<EventHandler, SubscriptionFilter>()
  private _history = new Map<string, RuntimeEvent[]>()
  private _historyLimit = 100

  // ── Middleware ──
  private _middleware: EventMiddleware[] = []

  // ── Lifecycle hooks ──
  private _lifecycleHooks = new Set<LifecycleListener>()

  // ── Producer info ──
  private _defaultSource = 'runtime'

  // ── Configuration ──
  constructor(config?: { historyLimit?: number; defaultSource?: string }) {
    if (config?.historyLimit) this._historyLimit = config.historyLimit
    if (config?.defaultSource) this._defaultSource = config.defaultSource
  }

  // ═════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═════════════════════════════════════════════════════════════════

  /**
   * Эмитить событие с типизированным payload.
   *
   * Usage:
   *   emit<MarketTick>("market.tick", { symbol: "BTCUSDT", price: 50000 })
   *
   *   emit("market.tick", data, { source: "MyPlugin", severity: "info" })
   */
  emit<T = unknown>(
    topic: string,
    payload: T,
    opts?: {
      source?: string
      severity?: EventSeverity
      correlationId?: string
      causationId?: string
      metadata?: Record<string, unknown>
    },
  ): RuntimeEvent<T> {
    // 1. Create canonical RuntimeEvent
    const event = createEvent(topic, payload, {
      source: opts?.source ?? this._defaultSource,
      severity: opts?.severity,
      correlationId: opts?.correlationId,
      causationId: opts?.causationId,
      metadata: opts?.metadata,
    })

    // 2. Lifecycle: created
    this._notifyLifecycle(event, { stage: 'created' })

    // 3. Validate
    EventRegistry.validate(event)
    this._notifyLifecycle(event, { stage: 'validated' })

    // 4. Middleware pipeline
    this._runMiddleware(event, () => {
      // 5. Dispatch to subscribers
      this._dispatch(event)

      // 6. Store in history
      this._storeHistory(event)

      // 7. Lifecycle: completed
      this._notifyLifecycle(event, { stage: 'completed' })
    })

    return event
  }

  /**
   * Подписаться на событие.
   *
   * Usage:
   *   on<MarketTick>("market.tick", (event) => console.log(event.payload))
   *   on("market.*", handler) // wildcard
   *   on((event) => console.log(event)) // все события (catch-all)
   */
  on<T = unknown>(
    topicOrHandler: string | EventHandler<T>,
    handler?: EventHandler<T>,
    filter?: SubscriptionFilter,
  ): Unsubscribe {
    // Catch-all: on(handler)
    if (typeof topicOrHandler === 'function') {
      return this._subscribe('*', topicOrHandler as EventHandler, filter)
    }

    const topic = topicOrHandler
    const h = handler!

    // Wildcard: on("market.*", handler)
    if (topic.includes('*')) {
      return this._subscribeWildcard(topic, h)
    }

    return this._subscribe(topic, h, filter)
  }

  /**
   * Подписаться однократно.
   */
  once<T = unknown>(
    topic: string,
    handler: EventHandler<T>,
    filter?: SubscriptionFilter,
  ): Unsubscribe {
    const wrapped: EventHandler<T> = (event) => {
      handler(event)
      unsubscribe()
    }
    const unsubscribe = this._subscribe(topic, wrapped, filter)
    return unsubscribe
  }

  /**
   * Отписаться.
   */
  off<T = unknown>(topic: string, handler: EventHandler<T>): void {
    this._handlers.get(topic)?.delete(handler as EventHandler)
  }

  /**
   * Добавить middleware.
   *
   * Usage:
   *   eventBus.use(loggingMiddleware)
   *   eventBus.use(metricsMiddleware)
   */
  use(middleware: EventMiddleware): void {
    this._middleware.push(middleware)
  }

  /**
   * Слушать lifecycle события EventBus.
   */
  onLifecycle(listener: LifecycleListener): Unsubscribe {
    this._lifecycleHooks.add(listener)
    return () => this._lifecycleHooks.delete(listener)
  }

  /**
   * Получить последние N событий.
   */
  history(limit?: number): RuntimeEvent[] {
    const all: RuntimeEvent[] = []
    for (const events of this._history.values()) {
      all.push(...events)
    }
    return all
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit ?? 50)
  }

  /**
   * Очистить историю событий.
   */
  clearHistory(): void {
    this._history.clear()
  }

  /**
   * Получить количество подписчиков.
   */
  listenerCount(topic?: string): number {
    if (topic) {
      return (this._handlers.get(topic)?.size ?? 0)
    }
    let count = 0
    for (const handlers of this._handlers.values()) {
      count += handlers.size
    }
    return count
  }

  /**
   * Очистить все подписки.
   */
  clear(): void {
    this._handlers.clear()
    this._onceHandlers.clear()
    this._wildcardHandlers.clear()
    this._filters.clear()
    this._history.clear()
    this._middleware.length = 0
    this._lifecycleHooks.clear()
  }

  /**
   * Сбросить — очистить всё, но сохранить middleware по умолчанию.
   */
  reset(): void {
    this._handlers.clear()
    this._onceHandlers.clear()
    this._wildcardHandlers.clear()
    this._filters.clear()
    this._history.clear()
    this._lifecycleHooks.clear()
  }

  /**
   * Установить источник по умолчанию.
   */
  setDefaultSource(source: string): void {
    this._defaultSource = source
  }

  // ═════════════════════════════════════════════════════════════════
  //  INTERNAL
  // ═════════════════════════════════════════════════════════════════

  private _subscribe(topic: string, handler: EventHandler, filter?: SubscriptionFilter): Unsubscribe {
    if (!this._handlers.has(topic)) {
      this._handlers.set(topic, new Set())
    }
    this._handlers.get(topic)!.add(handler)

    if (filter) {
      this._filters.set(handler, filter)
    }

    // Доставить последнее историческое событие
    const lastEvents = this._history.get(topic)
    if (lastEvents && lastEvents.length > 0) {
      const last = lastEvents[lastEvents.length - 1]
      handler(last)
    }

    return () => this.off(topic, handler)
  }

  private _subscribeWildcard(pattern: string, handler: EventHandler): Unsubscribe {
    if (!this._wildcardHandlers.has(pattern)) {
      this._wildcardHandlers.set(pattern, new Set())
    }
    this._wildcardHandlers.get(pattern)!.add(handler)
    return () => this._wildcardHandlers.get(pattern)?.delete(handler)
  }

  /** Match wildcard pattern against topic */
  private _matchWildcard(pattern: string, topic: string): boolean {
    if (pattern === '*') return true
    const regex = new RegExp('^' + pattern.replace(/\.\*/g, '\\.[^.]+').replace(/\*/g, '.*') + '$')
    return regex.test(topic)
  }

  private _dispatch(event: RuntimeEvent): void {
    this._notifyLifecycle(event, { stage: 'dispatched' })

    // 1. Exact handlers
    const exactHandlers = this._handlers.get(event.topic)
    if (exactHandlers) {
      for (const handler of exactHandlers) {
        this._callHandler(handler, event)
      }
    }

    // 2. Wildcard handlers
    for (const [pattern, handlers] of this._wildcardHandlers) {
      if (this._matchWildcard(pattern, event.topic)) {
        for (const handler of handlers) {
          this._callHandler(handler, event)
        }
      }
    }

    // 3. Once handlers
    const onceHandlers = this._onceHandlers.get(event.topic)
    if (onceHandlers) {
      for (const handler of onceHandlers) {
        this._callHandler(handler, event)
      }
      this._onceHandlers.delete(event.topic)
    }
  }

  private _callHandler(handler: EventHandler, event: RuntimeEvent): void {
    // Filter check
    const filter = this._filters.get(handler)
    if (filter) {
      if (filter.topics && !filter.topics.some(t => {
        if (typeof t === 'string') return t === event.topic
        return t.test(event.topic)
      })) return
      if (filter.sources && !filter.sources.includes(event.source)) return
      if (filter.severity && event.severity !== filter.severity) return
    }

    try {
      handler(event)
    } catch (err) {
      console.error(`[EventBus] Error in handler for '${event.topic}':`, err)
    }
  }

  private _storeHistory(event: RuntimeEvent): void {
    if (!this._history.has(event.topic)) {
      this._history.set(event.topic, [])
    }
    const events = this._history.get(event.topic)!
    events.push(event)
    if (events.length > this._historyLimit) {
      events.splice(0, events.length - this._historyLimit)
    }
  }

  private _runMiddleware(event: RuntimeEvent, done: () => void): void {
    let index = 0

    if (this._middleware.length === 0) {
      this._notifyLifecycle(event, { stage: 'middleware' })
      done()
      return
    }

    const next = () => {
      if (index >= this._middleware.length) {
        this._notifyLifecycle(event, { stage: 'middleware' })
        done()
        return
      }
      const mw = this._middleware[index++]
      try {
        mw(event, next)
      } catch (err) {
        console.error(`[EventBus] Middleware error:`, err)
        this._notifyLifecycle(event, { stage: 'error', error: String(err) })
      }
    }

    next()
  }

  private _notifyLifecycle(event: RuntimeEvent, status: EventStatus): void {
    for (const listener of this._lifecycleHooks) {
      try {
        listener(event, status)
      } catch {
        // silent
      }
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

export const runtimeEventBus = new EventBus({
  defaultSource: 'runtime',
  historyLimit: 100,
})

// ─── Built-in Middleware ─────────────────────────────────────────────

/**
 * Логирование событий в консоль.
 */
export function loggingMiddleware(event: RuntimeEvent, next: () => void): void {
  if (event.severity === 'error') {
    console.error(`[EventBus] ${event.topic}`, event.payload)
  } else if (event.severity === 'warn') {
    console.warn(`[EventBus] ${event.topic}`, event.payload)
  } else {
    console.log(`[EventBus] ${event.topic}`, event.payload)
  }
  next()
}

/**
 * Метрики событий — считает количество событий по типу.
 */
export function metricsMiddleware(event: RuntimeEvent, next: () => void): void {
  metricsMiddleware.counters[event.topic] = (metricsMiddleware.counters[event.topic] ?? 0) + 1
  metricsMiddleware.total++
  next()
}
metricsMiddleware.counters = {} as Record<string, number>
metricsMiddleware.total = 0
metricsMiddleware.reset = () => {
  metricsMiddleware.counters = {}
  metricsMiddleware.total = 0
}

/**
 * Permission middleware — заглушка для контроля доступа.
 */
export function permissionMiddleware(event: RuntimeEvent, next: () => void): void {
  // TODO: проверять права source на эмит в topic
  next()
}

/**
 * Replay middleware — перенаправляет события в EventRecorder.
 */
export function replayMiddleware(event: RuntimeEvent, next: () => void): void {
  // EventRecorder подписывается отдельно через on('*')
  next()
}
