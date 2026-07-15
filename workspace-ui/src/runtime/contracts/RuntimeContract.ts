/**
 * Runtime Contract — базовый интерфейс контрактного тестирования
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Любая реализация Runtime (REST, WS, Simulation, Cloud, Mock) должна
 * проходить один набор тестов через describeRuntimeContract<T>().
 *
 * Usage:
 *   describeRuntimeContract('REST MarketRuntime', new MarketRestRuntime(), {
 *     contract: MarketRuntimeContract,
 *     tests: MarketRuntimeTests,
 *   })
 */

import type { RuntimeEvent } from '../RuntimeEvent'

// ═════════════════════════════════════════════════════════════════════
//  Service Contract Interfaces
// ═════════════════════════════════════════════════════════════════════

/** Market Runtime — торговые данные */
export interface MarketRuntimeContract {
  readonly id: string

  /** Получить список доступных символов */
  symbols(): Promise<string[]>

  /** Подписаться на тики */
  subscribe(symbols: string[]): Promise<void>

  /** Отписаться от тиков */
  unsubscribe(symbols: string[]): Promise<void>

  /** Получить текущий спредбук / order book */
  orderBook?(symbol: string, depth?: number): Promise<{ bids: [number, number][]; asks: [number, number][] }>

  /** Получить последние свечи */
  candles?(symbol: string, interval?: string, limit?: number): Promise<{ time: number; open: number; high: number; low: number; close: number; volume: number }[]>

  /** Проверить соединение */
  health(): Promise<{ ok: boolean; latency: number }>

  /** Подписаться на поток событий */
  onEvent(cb: (event: RuntimeEvent) => void): () => void
}

/** Replay Runtime — воспроизведение исторических данных */
export interface ReplayRuntimeContract {
  readonly id: string

  /** Начать воспроизведение */
  play(speed?: number): Promise<void>

  /** Приостановить */
  pause(): Promise<void>

  /** Перемотать на timestamp */
  seek(timestamp: number): Promise<void>

  /** Текущее состояние */
  state(): Promise<'idle' | 'playing' | 'paused'>

  /** Загрузить данные для воспроизведения */
  load(events: RuntimeEvent[]): Promise<void>

  /** Получить текущий прогресс */
  progress(): Promise<{ current: number; total: number; speed: number }>

  onEvent(cb: (event: RuntimeEvent) => void): () => void
}

/** Plugin Runtime — управление плагинами */
export interface PluginRuntimeContract {
  readonly id: string

  /** Список установленных плагинов */
  list(): Promise<{ id: string; state: string; version: string }[]>

  /** Информация о плагине */
  info(id: string): Promise<{ manifest: unknown; state: string }>

  onEvent(cb: (event: RuntimeEvent) => void): () => void
}

/** Portfolio Runtime — портфель и балансы */
export interface PortfolioRuntimeContract {
  readonly id: string

  /** Получить баланс */
  balance(asset?: string): Promise<{ asset: string; free: number; locked: number; total: number }[]>

  /** Открытые позиции */
  positions(): Promise<{ symbol: string; side: 'long' | 'short'; size: number; entryPrice: number; currentPrice: number; pnl: number }[]>

  onEvent(cb: (event: RuntimeEvent) => void): () => void
}

/** Strategy Runtime — управление стратегиями */
export interface StrategyRuntimeContract {
  readonly id: string

  /** Список активных стратегий */
  list(): Promise<{ id: string; name: string; status: string; metrics: Record<string, number> }[]>

  /** Запустить стратегию */
  start(id: string, params?: Record<string, unknown>): Promise<void>

  /** Остановить стратегию */
  stop(id: string): Promise<void>

  /** Получить метрики */
  metrics(id: string): Promise<Record<string, number>>

  onEvent(cb: (event: RuntimeEvent) => void): () => void
}

/** ML Runtime — модели и предсказания */
export interface MLRuntimeContract {
  readonly id: string

  /** Список моделей */
  list(): Promise<{ id: string; name: string; version: string; status: string }[]>

  /** Предсказание */
  predict(modelId: string, features: number[]): Promise<{ prediction: number; confidence: number }>

  onEvent(cb: (event: RuntimeEvent) => void): () => void
}

/** Search Runtime — поиск */
export interface SearchRuntimeContract {
  readonly id: string

  /** Поиск */
  search(query: string, limit?: number): Promise<{ results: { title: string; description: string; type: string; url: string }[]; total: number }>

  onEvent(cb: (event: RuntimeEvent) => void): () => void
}

/** EventStore Runtime — хранение событий */
export interface EventStoreRuntimeContract {
  readonly id: string

  /** Сохранить событие */
  store(event: RuntimeEvent): Promise<void>

  /** Получить события по фильтру */
  query(filter: { topic?: string; source?: string; from?: number; to?: number; limit?: number }): Promise<RuntimeEvent[]>

  onEvent(cb: (event: RuntimeEvent) => void): () => void
}

/** Notification Runtime — оповещения */
export interface NotificationRuntimeContract {
  readonly id: string

  /** Отправить уведомление */
  send(notification: { title: string; message: string; level?: 'info' | 'warn' | 'error' }): Promise<{ id: string }>

  /** Получить историю */
  history(limit?: number): Promise<{ id: string; title: string; message: string; level: string; timestamp: number }[]>

  onEvent(cb: (event: RuntimeEvent) => void): () => void
}

// ═════════════════════════════════════════════════════════════════════
//  Full Runtime Contract
// ═════════════════════════════════════════════════════════════════════

/** Полный контракт Runtime — все сервисы */
export interface RuntimeContract {
  market: MarketRuntimeContract
  replay: ReplayRuntimeContract
  plugin: PluginRuntimeContract
  portfolio: PortfolioRuntimeContract
  strategy: StrategyRuntimeContract
  ml: MLRuntimeContract
  search: SearchRuntimeContract
  eventStore: EventStoreRuntimeContract
  notification: NotificationRuntimeContract

  /** Инициализация */
  init(): Promise<void>

  /** Очистка */
  destroy(): Promise<void>
}

// ═════════════════════════════════════════════════════════════════════
//  Test Utilities
// ═════════════════════════════════════════════════════════════════════

/** Дождаться события по фильтру (таймаут 5s) */
export async function waitForEvent(
  subscribe: (cb: (event: RuntimeEvent) => void) => () => void,
  filter: (event: RuntimeEvent) => boolean,
  timeout = 5_000,
): Promise<RuntimeEvent> {
  return new Promise((resolve, reject) => {
    const unsub = subscribe((event) => {
      if (filter(event)) {
        unsub()
        resolve(event)
      }
    })
    setTimeout(() => {
      unsub()
      reject(new Error('Timeout waiting for event'))
    }, timeout)
  })
}

/** Задержка */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
