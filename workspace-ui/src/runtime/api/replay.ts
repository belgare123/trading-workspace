/**
 * Replay Service API — v1.0.0
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Управление историческим реплеем: воспроизведение, пауза, скорость.
 * Изменение сигнатур методов запрещено.
 */

export const REPLAY_TOPICS = {
  STATE_CHANGE: 'replay.state'      as const,
  TIME_CHANGE:  'replay.time'       as const,
  SPEED_CHANGE: 'replay.speed'      as const,
  COMPLETE:     'replay.complete'   as const,
} as const

export type ReplayState = 'idle' | 'playing' | 'paused' | 'seeking'

export interface ReplayApi {
  readonly id: 'replay'

  /** Текущее состояние реплея */
  state(): ReplayState

  /** Активен ли реплей */
  isActive(): boolean

  /** Текущее время реплея */
  currentTime(): string

  /** Начать воспроизведение */
  play(): void

  /** Поставить на паузу */
  pause(): void

  /** Переместиться к указанному времени */
  seek(time: string): void

  /** Установить скорость воспроизведения (1x, 2x, 10x, ...) */
  setSpeed(speed: number): void

  /** Получить текущую скорость */
  getSpeed(): number

  /** Остановить реплей */
  stop(): void
}

export const REPLAY_API_VERSION = '1.0.0'
