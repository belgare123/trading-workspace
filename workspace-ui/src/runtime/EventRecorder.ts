/**
 * EventRecorder — запись событий в ring buffer и storage
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Часть Runtime, а не DevTools. Работает как middleware:
 *   emit() → EventBus → EventRecorder → Ring Buffer → Storage
 *
 * Profiler и DevTools подписываются на готовый поток.
 */

import type { RuntimeEvent } from './RuntimeEvent'
import { runtimeEventBus } from './EventBus'

// ─── Recording State ────────────────────────────────────────────────

export type RecorderStatus = 'idle' | 'recording' | 'paused'

interface RecorderState {
  status: RecorderStatus
  startedAt: number
  eventCount: number
  bufferSize: number
}

// ─── Recorder ───────────────────────────────────────────────────────

class EventRecorderImpl {
  private _status: RecorderStatus = 'idle'
  private _buffer: RuntimeEvent[] = []
  private _bufferMaxSize = 10_000
  private _startedAt = 0
  private _eventCount = 0
  private _onEvent: ((event: RuntimeEvent) => void) | null = null
  private _unsubscribe: (() => void) | null = null

  /**
   * Начать запись всех событий EventBus в ring buffer.
   */
  start(): void {
    if (this._status === 'recording') return

    this._status = 'recording'
    this._startedAt = Date.now()
    this._eventCount = 0
    this._buffer = []

    // Подписываемся на все события через catch-all
    this._unsubscribe = runtimeEventBus.on('*', (event: RuntimeEvent) => {
      this._record(event)
    })

    console.log('[EventRecorder] Recording started')
  }

  /**
   * Приостановить запись.
   */
  pause(): void {
    if (this._status !== 'recording') return
    this._status = 'paused'
    console.log('[EventRecorder] Recording paused')
  }

  /**
   * Возобновить запись.
   */
  resume(): void {
    if (this._status !== 'paused') return
    this._status = 'recording'
    console.log('[EventRecorder] Recording resumed')
  }

  /**
   * Остановить запись и вернуть буфер.
   */
  stop(): RuntimeEvent[] {
    if (this._status === 'idle') return []

    this._status = 'idle'
    if (this._unsubscribe) {
      this._unsubscribe()
      this._unsubscribe = null
    }

    const snapshot = [...this._buffer]
    console.log(`[EventRecorder] Recording stopped: ${snapshot.length} events captured`)
    return snapshot
  }

  /**
   * Получить текущий буфер.
   */
  getBuffer(): RuntimeEvent[] {
    return [...this._buffer]
  }

  /**
   * Очистить буфер.
   */
  clearBuffer(): void {
    this._buffer = []
    this._eventCount = 0
  }

  /**
   * Сохранить буфер в storage (localStorage / IndexedDB).
   * Пока используем localStorage с лимитом ~1MB.
   */
  save(label?: string): string | null {
    if (this._buffer.length === 0) return null

    const key = `recording_${label ?? Date.now().toString(36)}`
    const data = JSON.stringify({
      label: label ?? 'untitled',
      startedAt: this._startedAt,
      stoppedAt: Date.now(),
      events: this._buffer,
      count: this._buffer.length,
    })

    try {
      localStorage.setItem(key, data)
      console.log(`[EventRecorder] Saved ${this._buffer.length} events to '${key}'`)
      return key
    } catch (e) {
      console.warn('[EventRecorder] Failed to save to localStorage:', e)
      return null
    }
  }

  /**
   * Загрузить запись из storage.
   */
  load(key: string): RuntimeEvent[] | null {
    try {
      const data = localStorage.getItem(key)
      if (!data) return null
      const parsed = JSON.parse(data)
      console.log(`[EventRecorder] Loaded ${parsed.events.length} events from '${key}'`)
      return parsed.events as RuntimeEvent[]
    } catch {
      console.warn(`[EventRecorder] Failed to load '${key}'`)
      return null
    }
  }

  /**
   * Список сохранённых записей.
   */
  listSaved(): { key: string; label: string; count: number; date: number }[] {
    const results: { key: string; label: string; count: number; date: number }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('recording_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key)!)
          results.push({
            key,
            label: data.label ?? 'untitled',
            count: data.count ?? 0,
            date: data.stoppedAt ?? 0,
          })
        } catch {
          // skip corrupted
        }
      }
    }
    return results.sort((a, b) => b.date - a.date)
  }

  /**
   * Удалить запись.
   */
  delete(key: string): void {
    localStorage.removeItem(key)
  }

  /**
   * Текущее состояние.
   */
  getState(): RecorderState {
    return {
      status: this._status,
      startedAt: this._startedAt,
      eventCount: this._eventCount,
      bufferSize: this._buffer.length,
    }
  }

  /**
   * Максимальный размер буфера.
   */
  setBufferSize(size: number): void {
    this._bufferMaxSize = size
  }

  // ── Private ──

  private _record(event: RuntimeEvent): void {
    this._eventCount++
    this._buffer.push(event)

    // Ring buffer: удаляем старые если превышен лимит
    if (this._buffer.length > this._bufferMaxSize) {
      this._buffer.splice(0, this._buffer.length - this._bufferMaxSize)
    }

    // Callback для Profiler / DevTools
    this._onEvent?.(event)
  }

  /**
   * Подписаться на поток событий в реальном времени.
   * Используется Profiler Studio для live-метрик.
   */
  onEvent(cb: (event: RuntimeEvent) => void): () => void {
    this._onEvent = cb
    return () => { this._onEvent = null }
  }
}

/** Singleton */
export const EventRecorder = new EventRecorderImpl()
