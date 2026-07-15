/**
 * Portfolio Service API — v1.0.0
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Управление портфелем: позиции, баланс, история.
 * Изменение сигнатур методов запрещено.
 */

export const PORTFOLIO_TOPICS = {
  POSITION_CHANGE: 'portfolio.position' as const,
  BALANCE_CHANGE:  'portfolio.balance'  as const,
  ORDER_FILLED:    'portfolio.order'    as const,
  PNL_UPDATE:      'portfolio.pnl'      as const,
} as const

export interface Position {
  pair: string
  dir: 'long' | 'short'
  size: number
  entry: number
  mark: number
  pnl: number
  pnlPercent: number
}

export interface Balance {
  total: number
  free: number
  used: number
  currency: string
}

export interface PortfolioApi {
  readonly id: 'portfolio'

  /** Все открытые позиции */
  positions(): Promise<Position[]>

  /** Текущий баланс */
  balance(): Promise<Balance>

  /** История позиций */
  history(): Promise<Position[]>

  /** Подписаться на обновления позиций */
  onPositionUpdate(cb: (position: Position) => void): () => void
}

export const PORTFOLIO_API_VERSION = '1.0.0'
