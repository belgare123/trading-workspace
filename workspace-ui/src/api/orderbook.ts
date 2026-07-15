const API_BASE = '/api/v1'

export interface OrderBookLevel {
  price: number
  size: number
  total: number
}

export interface OrderBookResponse {
  symbol: string
  spread: number
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`OrderBook API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export function fetchOrderBook(symbol = 'BTCUSDT', depth = 15): Promise<OrderBookResponse> {
  return fetchJson<OrderBookResponse>(`/orderbook?symbol=${symbol}&depth=${depth}`)
}
