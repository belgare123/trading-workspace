// ── Market Widget Types ───────────────────────────────────────────────

export interface WatchlistRow {
  symbol: string
  price: number
  change24h: number
  volume: number
  high24h: number
  low24h: number
  signal?: 'LONG' | 'SHORT' | null
}

export interface OrderBookLevel {
  price: number
  size: number
  total: number
}

export interface MarketOrderBook {
  symbol: string
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  spread: number
  timestamp: number
}

export interface Trade {
  id: string
  symbol: string
  price: number
  volume: number
  side: 'buy' | 'sell'
  time: number
}

export interface DepthPoint {
  price: number
  bidVolume: number
  askVolume: number
}

export interface HeatmapCell {
  symbol: string
  price: number
  change24h: number
  volume: number
  marketCap: number
}

export interface NewsItem {
  id: string
  title: string
  source: string
  url: string
  publishedAt: number
  sentiment: 'positive' | 'negative' | 'neutral'
  symbols: string[]
}

export interface Alert {
  id: string
  symbol: string
  type: 'price' | 'volume' | 'signal' | 'system'
  message: string
  severity: 'info' | 'warning' | 'critical'
  timestamp: number
  acknowledged: boolean
}

export interface ExchangeStatus {
  exchange: string
  connected: boolean
  latencyMs: number
  uptime: number
  lastReconnect?: number
  services: {
    name: string
    status: 'online' | 'degraded' | 'offline'
  }[]
}
