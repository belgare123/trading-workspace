// ── MarketContext — рыночные данные для стратегии ──
//
// Стратегия получает только то, что ей нужно:
//   ctx.market.price(symbol)
//   ctx.market.bars(symbol, limit)
//   ctx.market.ticker(symbol)
//
// Без прямого доступа к MarketApi или WebSocket.
// Без импорта runtime/api — полностью независимый слой.
//
// @since 3.4.2

export interface MarketTick {
  symbol: string
  price: number
  volume: number
  timestamp: number
}

export interface CandleData {
  symbol: string
  timeframe: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

export interface MarketContext {
  /** Текущая цена символа */
  price(symbol: string): Promise<number>

  /** Исторические свечи */
  bars(symbol: string, timeframe: string, limit?: number): Promise<CandleData[]>

  /** Текущий тикер (цена + объём) */
  ticker(symbol: string): Promise<MarketTick>

  /** Список доступных символов */
  symbols(): Promise<string[]>

  /** Подписаться на обновления цены */
  onPrice(symbol: string, cb: (price: number) => void): () => void
}
