/**
 * Search Service API — v1.0.0
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Полнотекстовый поиск по Runtime: плагины, виджеты, команды, настройки.
 * Изменение сигнатур методов запрещено.
 */

export const SEARCH_TOPICS = {
  INDEX_UPDATED: 'search.index' as const,
} as const

export interface SearchResult {
  id: string
  title: string
  description?: string
  type: string
  action: () => void
}

export interface SearchItem {
  id: string
  title: string
  keywords: string[]
  type: string
  action: () => void
}

export interface SearchApi {
  readonly id: 'search'

  /** Выполнить поиск */
  query(q: string): Promise<SearchResult[]>

  /** Зарегистрировать элементы в поисковом индексе */
  register(type: string, items: SearchItem[]): void

  /** Очистить индекс для указанного типа */
  unregister(type: string): void
}

export const SEARCH_API_VERSION = '1.0.0'
