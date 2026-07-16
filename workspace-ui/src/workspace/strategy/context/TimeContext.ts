// ── TimeContext — временные утилиты для стратегии ──
//
// Стратегия работает со временем только через ctx.time:
//   ctx.time.now()
//   ctx.time.format(timestamp)
//   ctx.time.isSessionOpen()
//
// @since 3.4.2

export interface TimeSession {
  open: number    // час открытия (0-23)
  close: number   // час закрытия (0-23)
  timezone: string
}

export interface TimeContext {
  /** Текущий timestamp в мс */
  now(): number

  /** Форматировать timestamp */
  format(timestamp: number, format?: string): string

  /** Является ли время внутри торговой сессии */
  isSessionOpen(session?: TimeSession): boolean

  /** Осталось времени до конца текущей свечи */
  candleRemaining(timeframe: string): number

  /** UNIX timestamp начала текущего дня */
  dayStart(): number

  /** Unix timestamp начала текущей недели */
  weekStart(): number
}
