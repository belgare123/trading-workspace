// ── OrderContext — размещение ордеров для стратегии ──
//
// Стратегия размещает ордера только через ctx.orders:
//   ctx.orders.marketBuy(symbol, qty)
//   ctx.orders.marketSell(symbol, qty)
//   ctx.orders.limitBuy(symbol, qty, price)
//
// Без прямого доступа к биржевому API.
//
// @since 3.4.2

export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit'

export interface OrderRequest {
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  price?: number
  stopPrice?: number
  reduceOnly?: boolean
  clientId?: string
}

export interface OrderResult {
  id: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  filledQuantity: number
  price: number
  status: 'filled' | 'partial' | 'pending' | 'cancelled' | 'rejected'
  timestamp: number
}

export interface OrderContext {
  /** Купить по рыночной цене */
  marketBuy(symbol: string, quantity: number): Promise<OrderResult>

  /** Продать по рыночной цене */
  marketSell(symbol: string, quantity: number): Promise<OrderResult>

  /** Лимитный ордер на покупку */
  limitBuy(symbol: string, quantity: number, price: number): Promise<OrderResult>

  /** Лимитный ордер на продажу */
  limitSell(symbol: string, quantity: number, price: number): Promise<OrderResult>

  /** Стоп-лосс ордер */
  stopLoss(symbol: string, quantity: number, stopPrice: number): Promise<OrderResult>

  /** Тейк-профит ордер */
  takeProfit(symbol: string, quantity: number, price: number): Promise<OrderResult>

  /** Отменить ордер */
  cancel(orderId: string): Promise<boolean>

  /** Статус ордера */
  status(orderId: string): Promise<OrderResult>

  /** История ордеров */
  history(symbol?: string, limit?: number): Promise<OrderResult[]>
}
