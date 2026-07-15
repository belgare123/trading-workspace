/**
 * EventRegistry — реестр схем событий Runtime
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Позволяет:
 * - регистрировать схему payload для каждого topic
 * - валидировать события перед отправкой
 * - генерировать документацию и DevTools
 * - в будущем — OpenAPI/AsyncAPI спецификацию
 */

import type { RuntimeEvent } from './RuntimeEvent'

// ─── Schema Descriptor ──────────────────────────────────────────────

export interface EventSchemaMeta {
  /** Topic (market.tick, strategy.signal, ...) */
  topic: string
  /** Человеческое описание */
  description: string
  /** Producer */
  source: string
  /** Default severity */
  severity: 'debug' | 'info' | 'warn' | 'error'
  /** Пример payload (JSON) */
  example?: unknown
  /** Допустимые под-топики (для wildcard-групп) */
  subtopics?: string[]
  /** since version */
  since?: string
}

// ─── Event Registry ─────────────────────────────────────────────────

class EventRegistryImpl {
  private _schemas = new Map<string, EventSchemaMeta>()

  /**
   * Зарегистрировать схему события.
   */
  register(meta: EventSchemaMeta): void {
    if (this._schemas.has(meta.topic)) {
      console.warn(`[EventRegistry] Overwriting schema for topic '${meta.topic}'`)
    }
    this._schemas.set(meta.topic, meta)
  }

  /**
   * Получить схему по topic.
   */
  get(topic: string): EventSchemaMeta | undefined {
    return this._schemas.get(topic)
  }

  /**
   * Получить все схемы.
   */
  getAll(): EventSchemaMeta[] {
    return Array.from(this._schemas.values())
  }

  /**
   * Получить схемы по namespace (market.*, plugin.*, ...)
   */
  getByNamespace(ns: string): EventSchemaMeta[] {
    return this.getAll().filter(s => s.topic.startsWith(ns))
  }

  /**
   * Удалить схему.
   */
  unregister(topic: string): boolean {
    return this._schemas.delete(topic)
  }

  /**
   * Валидация: проверяет, что topic зарегистрирован.
   * В будущем — валидация payload по JSON Schema.
   */
  validate<T>(event: RuntimeEvent<T>): boolean {
    const schema = this._schemas.get(event.topic)
    if (!schema) {
      // Неизвестный topic — пропускаем, но предупреждаем
      console.warn(`[EventRegistry] Unknown topic: '${event.topic}'`)
      return true
    }
    return true
  }

  /**
   * Получить все зарегистрированные топики.
   */
  topics(): string[] {
    return Array.from(this._schemas.keys())
  }

  /** Очистить реестр */
  clear(): void {
    this._schemas.clear()
  }
}

/** Singleton */
export const EventRegistry = new EventRegistryImpl()

// ─── Default Schemas ────────────────────────────────────────────────

// Регистрируем схемы при импорте модуля
function registerDefaults() {
  // Market
  EventRegistry.register({ topic: 'market.tick',       description: 'Новый тик рынка',          source: 'MarketService',  severity: 'info' })
  EventRegistry.register({ topic: 'market.price',      description: 'Обновление цены',          source: 'MarketService',  severity: 'info' })
  EventRegistry.register({ topic: 'market.orderbook',  description: 'Обновление стакана',       source: 'MarketService',  severity: 'info' })
  EventRegistry.register({ topic: 'market.candle',     description: 'Новая свеча',              source: 'MarketService',  severity: 'info' })
  EventRegistry.register({ topic: 'market.connection', description: 'Статус соединения',         source: 'MarketService',  severity: 'info' })

  // Strategy
  EventRegistry.register({ topic: 'strategy.signal',   description: 'Сигнал стратегии',         source: 'StrategyEngine', severity: 'info' })
  EventRegistry.register({ topic: 'strategy.started',  description: 'Стратегия запущена',       source: 'StrategyEngine', severity: 'info' })
  EventRegistry.register({ topic: 'strategy.stopped',  description: 'Стратегия остановлена',    source: 'StrategyEngine', severity: 'warn' })

  // Portfolio
  EventRegistry.register({ topic: 'portfolio.position', description: 'Открыта/закрыта позиция', source: 'PortfolioService', severity: 'info' })
  EventRegistry.register({ topic: 'portfolio.balance',  description: 'Изменение баланса',       source: 'PortfolioService', severity: 'info' })

  // Plugin
  EventRegistry.register({ topic: 'plugin.loaded',    description: 'Плагин загружен',           source: 'PluginRuntime', severity: 'info' })
  EventRegistry.register({ topic: 'plugin.ready',     description: 'Плагин готов к работе',     source: 'PluginRuntime', severity: 'info' })
  EventRegistry.register({ topic: 'plugin.crashed',   description: 'Плагин упал',               source: 'PluginRuntime', severity: 'error' })

  // Runtime
  EventRegistry.register({ topic: 'runtime.started',  description: 'Runtime запущен',           source: 'RuntimeKernel', severity: 'info' })
  EventRegistry.register({ topic: 'runtime.shutdown', description: 'Runtime завершён',          source: 'RuntimeKernel', severity: 'warn' })

  // System
  EventRegistry.register({ topic: 'system.warning',   description: 'Системное предупреждение',  source: 'System', severity: 'warn' })
  EventRegistry.register({ topic: 'system.error',     description: 'Системная ошибка',          source: 'System', severity: 'error' })

  // Replay
  EventRegistry.register({ topic: 'replay.play',     description: 'Реплей запущен',           source: 'ReplayService', severity: 'info' })
  EventRegistry.register({ topic: 'replay.pause',    description: 'Реплей приостановлен',     source: 'ReplayService', severity: 'info' })
  EventRegistry.register({ topic: 'replay.seek',     description: 'Реплей перемотан',         source: 'ReplayService', severity: 'info' })

  // ML
  EventRegistry.register({ topic: 'ml.train.started', description: 'Обучение модели начато',   source: 'MLService', severity: 'info' })
  EventRegistry.register({ topic: 'ml.train.finished',description: 'Обучение модели завершено',source: 'MLService', severity: 'info' })
  EventRegistry.register({ topic: 'ml.predict',       description: 'Предсказание модели',      source: 'MLService', severity: 'info' })

  // Notification
  EventRegistry.register({ topic: 'notification.sent', description: 'Уведомление отправлено',  source: 'NotificationService', severity: 'info' })
}

registerDefaults()
