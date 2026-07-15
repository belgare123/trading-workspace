/**
 * Notification Service API — v1.0.0
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Отправка и получение уведомлений.
 * Изменение сигнатур методов запрещено.
 */

export const NOTIFICATION_TOPICS = {
  NEW:     'notification.new'     as const,
  CLEARED: 'notification.cleared' as const,
} as const

export type NotificationLevel = 'info' | 'warn' | 'error'

/** Severity для RuntimeEvent */
export type EventSeverity = 'debug' | 'info' | 'warn' | 'error'

export interface NotificationEntry {
  id: string
  message: string
  level: NotificationLevel
  timestamp: number
  source?: string
}

export interface NotificationApi {
  readonly id: 'notification'

  /** Отправить уведомление */
  send(message: string, level?: NotificationLevel): void

  /** История уведомлений */
  history(): NotificationEntry[]

  /** Очистить все уведомления */
  clear(): void

  /** Подписаться на новые уведомления */
  onNotification(cb: (entry: NotificationEntry) => void): () => void
}

export const NOTIFICATION_API_VERSION = '1.0.0'
