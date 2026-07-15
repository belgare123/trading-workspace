/**
 * Strategy Service API — v1.0.0
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Управление торговыми стратегиями.
 * Изменение сигнатур методов запрещено.
 */

export const STRATEGY_TOPICS = {
  STATUS_CHANGE: 'strategy.status'  as const,
  METRICS:       'strategy.metrics'  as const,
  SIGNAL:        'strategy.signal'   as const,
  ERROR:         'strategy.error'    as const,
} as const

export interface StrategyInfo {
  id: string
  name: string
  status: 'active' | 'paused' | 'error'
  pair: string
  pnl24h: number
}

export interface StrategyMetrics {
  sharpe: number
  winRate: number
  totalTrades: number
  avgProfit: number
  maxDrawdown: number
}

export interface StrategyApi {
  readonly id: 'strategy'

  /** Список всех стратегий */
  list(): Promise<StrategyInfo[]>

  /** Активировать стратегию */
  enable(id: string): Promise<void>

  /** Деактивировать стратегию */
  disable(id: string): Promise<void>

  /** Получить метрики стратегии */
  metrics(id: string): Promise<StrategyMetrics>

  /** Подписаться на сигналы стратегии */
  onSignal(id: string, cb: (signal: unknown) => void): () => void
}

export const STRATEGY_API_VERSION = '1.0.0'
