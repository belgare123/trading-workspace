/**
 * RuntimeEvent — канонический формат всех событий Runtime
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Каждое событие проходит полный lifecycle:
 *   Producer → Validation → Middleware → EventBus → Subscribers → Archive
 *
 * Поддерживает трассировку через correlationId (горизонтальная связь)
 * и causationId (вертикальная, дерево причин).
 */

import type { EventSeverity } from '../api'

// ─── Canonical RuntimeEvent ──────────────────────────────────────────

export interface RuntimeEvent<T = unknown> {
  /** UUID v7 — уникальный идентификатор события */
  id: string

  /** Unix timestamp (ms) — когда событие создано */
  timestamp: number

  /** Topic: пространство имён + имя (напр. market.tick) */
  topic: string

  /** Producer — кто создал событие (напр. MarketService) */
  source: string

  /** Correlation ID — связь между событиями одного контекста */
  correlationId?: string

  /** Causation ID — родительское событие (дерево трассировки) */
  causationId?: string

  /** Severity */
  severity: EventSeverity

  /** Schema version — версия структуры payload */
  version: 1

  /** Payload — данные события */
  payload: T

  /** Optional metadata — для расширений без ломания версии */
  metadata?: Record<string, unknown>
}

// ─── Event Lifecycle Stages ─────────────────────────────────────────

export type EventLifecycleStage =
  | 'created'
  | 'validated'
  | 'middleware'
  | 'dispatched'
  | 'completed'
  | 'archived'
  | 'error'

// ─── Event Status ───────────────────────────────────────────────────

export interface EventStatus {
  stage: EventLifecycleStage
  error?: string
  duration?: number
}

// ─── Helpers ────────────────────────────────────────────────────────

let _eventIdCounter = 0

/**
 * Создать RuntimeEvent с авто-ID (UUID-like) и timestamp.
 */
export function createEvent<T>(
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
  const now = Date.now()
  const id = `${now.toString(36)}-${(_eventIdCounter++).toString(36).padStart(4, '0')}`

  return {
    id,
    timestamp: now,
    topic,
    source: opts?.source ?? 'runtime',
    severity: opts?.severity ?? 'info',
    version: 1,
    payload,
    correlationId: opts?.correlationId,
    causationId: opts?.causationId,
    metadata: opts?.metadata,
  }
}

/**
 * Type guard: проверить, является ли объект RuntimeEvent.
 */
export function isRuntimeEvent(obj: unknown): obj is RuntimeEvent {
  if (typeof obj !== 'object' || obj === null) return false
  const e = obj as Partial<RuntimeEvent>
  return (
    typeof e.id === 'string' &&
    typeof e.timestamp === 'number' &&
    typeof e.topic === 'string' &&
    typeof e.version === 'number' &&
    e.version === 1
  )
}

/**
 * Создать пустой RuntimeEvent (для тестов / fallback).
 */
export function emptyEvent(): RuntimeEvent<never> {
  return {
    id: '',
    timestamp: 0,
    topic: '',
    source: 'runtime',
    severity: 'debug',
    version: 1,
    payload: undefined as never,
  }
}
