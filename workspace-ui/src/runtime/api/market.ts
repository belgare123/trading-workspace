/**
 * Market Service API — v1.0.0
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Доступ к рыночным данным: цены, стаканы, подписки.
 * Изменение сигнатур методов запрещено — только расширение через новые интерфейсы.
 */

// ── Events ───────────────────────────────────────────────────────────
/** Топики событий Market Service */
export const MARKET_TOPICS = {
  PRICE:       'market.price'       as const,
  TICK:        'market.tick'        as const,
  ORDERBOOK:   'market.orderbook'   as const,
  CANDLE:      'market.candle'      as const,
  CONNECTION:  'market.connection'  as const,
} as const

// ── Types ────────────────────────────────────────────────────────────
export interface OrderBookLevel {
  price: number
  size: number
}

export interface OrderBook {
  symbol: string
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  timestamp: number
}

export interface MarketTick {
  symbol: string
  price: number
  volume: number
  timestamp: number
}

export interface Candle {
  symbol: string
  timeframe: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

// ── Public API ───────────────────────────────────────────────────────
export interface MarketApi {
  /** Уникальный идентификатор сервиса */
  readonly id: 'market'

  /**
   * Получить текущую цену символа.
   * @param symbol — тикер (напр. 'BTCUSDT')
   */
  price(symbol: string): Promise<number>

  /**
   * Получить список доступных символов.
   */
  symbols(): Promise<string[]>

  /**
   * Подписаться на обновления цены.
   * @param symbol — тикер
   * @param cb — callback с новой ценой
   * @returns функция отписки
   */
  subscribe(symbol: string, cb: (price: number) => void): () => void

  /**
   * Получить стакан заявок.
   * @param symbol — тикер
   */
  orderBook(symbol: string): Promise<OrderBook>

  /**
   * Подписаться на тики.
   * @param symbol — тикер
   * @param cb — callback с тиком
   */
  onTick(symbol: string, cb: (tick: MarketTick) => void): () => void
}

// ── Compatibility marker ─────────────────────────────────────────────
/** Версия API */
export const MARKET_API_VERSION = '1.0.0'
