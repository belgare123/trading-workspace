// ── PositionContext — текущие позиции для стратегии ──
//
// Стратегия проверяет позиции только через ctx.position:
//   ctx.position.current(symbol)
//   ctx.position.all()
//   ctx.position.pnl(symbol)
//
// @since 3.4.2

export interface PositionData {
  symbol: string
  direction: 'long' | 'short'
  size: number
  entryPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
  openedAt: number
  updatedAt: number
}

export interface PositionContext {
  /** Текущая позиция по символу (null если нет) */
  current(symbol: string): Promise<PositionData | null>

  /** Все открытые позиции */
  all(): Promise<PositionData[]>

  /** PnL по символу */
  pnl(symbol: string): Promise<number>

  /** Количество открытых позиций */
  count(): Promise<number>

  /** Есть ли позиция по символу */
  has(symbol: string): Promise<boolean>

  /** Событие изменения позиции */
  onChange(cb: (position: PositionData) => void): () => void
}
