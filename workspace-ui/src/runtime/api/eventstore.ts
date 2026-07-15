/**
 * EventStore Service API — v1.0.0
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Хранилище событий: запрос, подписка, фильтрация.
 * Изменение сигнатур методов запрещено.
 */

export const EVENTSTORE_TOPICS = {
  EVENT_APPENDED: 'eventstore.append' as const,
  QUERY_RESULT:   'eventstore.query'  as const,
} as const

export interface EventEntry {
  id: string
  type: string
  source: string
  timestamp: number
  data: Record<string, unknown>
}

export interface EventFilter {
  types?: string[]
  sources?: string[]
  limit?: number
  from?: number
  to?: number
}

export interface EventStoreApi {
  readonly id: 'eventStore'

  /** Запрос событий по фильтру */
  query(filter: EventFilter): Promise<EventEntry[]>

  /** Подписка на события по фильтру */
  subscribe(filter: EventFilter, cb: (event: EventEntry) => void): () => void

  /** Добавить событие в хранилище */
  append(event: Omit<EventEntry, 'id' | 'timestamp'>): Promise<string>
}

export const EVENTSTORE_API_VERSION = '1.0.0'
