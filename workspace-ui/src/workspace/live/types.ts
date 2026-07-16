/**
 * types.ts — Market Data Layer types
 *
 * Single source of truth for all market event types.
 *
 * @since 4.2
 */

// ═══════════════════════════════════════
// Market Event Types
// ═══════════════════════════════════════

export type MarketEventType =
  | 'market:connected'
  | 'market:disconnected'
  | 'market:ticker'
  | 'market:trade'
  | 'market:kline'
  | 'market:orderbook'
  | 'market:error'
  | 'market:reconnect'
  | 'market:latency'

// ═══════════════════════════════════════
// Market Event Payloads
// ═══════════════════════════════════════

export interface TickerEvent {
  symbol: string
  price: number
  change24h: number
  volume24h: number
  high24h: number
  low24h: number
  timestamp: number
}

export interface TradeEvent {
  symbol: string
  tradeId: string
  price: number
  quantity: number
  side: 'buy' | 'sell'
  timestamp: number
}

export type KlineInterval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '1M'

export interface KlineEvent {
  symbol: string
  interval: KlineInterval
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
  closed: boolean
}

export interface OrderBookLevel {
  price: number
  quantity: number
}

export interface OrderBookEvent {
  symbol: string
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  firstUpdateId: number
  lastUpdateId: number
  timestamp: number
}

export interface MarketErrorEvent {
  symbol?: string
  code: string
  message: string
  timestamp: number
}

export interface LatencyEvent {
  adapterId: string
  latencyMs: number
  timestamp: number
}

// ═══════════════════════════════════════
// Event Union
// ═══════════════════════════════════════

export type MarketEvent =
  | { type: 'market:connected'; adapterId: string; timestamp: number }
  | { type: 'market:disconnected'; adapterId: string; timestamp: number }
  | { type: 'market:ticker'; data: TickerEvent }
  | { type: 'market:trade'; data: TradeEvent }
  | { type: 'market:kline'; data: KlineEvent }
  | { type: 'market:orderbook'; data: OrderBookEvent }
  | { type: 'market:error'; data: MarketErrorEvent }
  | { type: 'market:reconnect'; adapterId: string; attempt: number; timestamp: number }
  | { type: 'market:latency'; data: LatencyEvent }
