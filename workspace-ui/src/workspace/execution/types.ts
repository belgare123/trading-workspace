// ── Execution Types — shared contracts for the Execution Simulator ──
//
// All types used across orders, fills, positions, ledger, and models.
// No imports from strategy/ — this module is a standalone platform subsystem.
//
// @since 3.5.1

// ═══════════════════════════════════════
// Order Types
// ═══════════════════════════════════════

export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit'
export type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'DAY'

export const OrderStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  PARTIALLY_FILLED: 'partially_filled',
  FILLED: 'filled',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
} as const

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

export interface OrderRequest {
  id: string
  strategyId: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  price?: number
  stopPrice?: number
  reduceOnly?: boolean
  timeInForce?: TimeInForce
  clientId?: string
  timestamp: number
}

export interface Order {
  id: string
  strategyId: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  filledQuantity: number
  averagePrice: number
  commission: number
  price?: number
  stopPrice?: number
  status: OrderStatus
  createdAt: number
  updatedAt: number
  expiresAt?: number
  reduceOnly?: boolean
  timeInForce: TimeInForce
  clientId?: string

  /** If rejected, the reason */
  rejectReason?: string
}

// ═══════════════════════════════════════
// Fill Types
// ═══════════════════════════════════════

export interface Fill {
  id: string
  orderId: string
  symbol: string
  side: OrderSide
  quantity: number
  price: number
  commission: number
  commissionAsset: string
  slippage: number
  timestamp: number
}

export interface FillResult {
  fills: Fill[]
  remainingQuantity: number
  status: OrderStatus
}

// ═══════════════════════════════════════
// Position Types
// ═══════════════════════════════════════

export type PositionDirection = 'long' | 'short' | 'flat'

export interface Position {
  symbol: string
  direction: PositionDirection
  quantity: number
  averageEntryPrice: number
  currentPrice: number
  unrealizedPnl: number
  realizedPnl: number
  openedAt: number
  updatedAt: number
}

// ═══════════════════════════════════════
// Ledger Types
// ═══════════════════════════════════════

export interface TradeRecord {
  id: string
  symbol: string
  side: OrderSide
  quantity: number
  price: number
  commission: number
  realizedPnl: number
  timestamp: number
  strategyId: string
  orderId: string
}

export interface CashBalance {
  asset: string
  free: number
  locked: number
  total: number
}

export interface EquitySnapshot {
  cash: number
  positionsValue: number
  totalEquity: number
  unrealizedPnl: number
  timestamp: number
}

// ═══════════════════════════════════════
// Market Data Types
// ═══════════════════════════════════════

export interface BarSnapshot {
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface MarketSnapshot {
  symbol: string
  bid: number
  ask: number
  last: number
  volume: number
  timestamp: number
  bar?: BarSnapshot
}

// ═══════════════════════════════════════
// Model Interfaces
// ═══════════════════════════════════════

export interface FillModel {
  execute(order: Order, market: MarketSnapshot): FillResult
}

export interface CommissionModel {
  calculate(params: {
    symbol: string
    side: OrderSide
    quantity: number
    price: number
    orderType: OrderType
  }): number
}

export interface SlippageModel {
  calculate(params: {
    side: string
    quantity: number
    price: number
    orderType: OrderType
    market: MarketSnapshot
  }): number
}

// ═══════════════════════════════════════
// Execution Config & Results
// ═══════════════════════════════════════

export interface ExecutionConfig {
  initialCash: number
  fillModel: FillModel
  commissionModel: CommissionModel
  slippageModel: SlippageModel
  assets?: string[]
}

export interface ExecutionResult {
  processedOrders: number
  filledOrders: number
  rejectedOrders: number
  totalFilledQuantity: number
  totalCommission: number
  totalSlippage: number
  positions: Position[]
  equity: EquitySnapshot
  duration: number
}

// ═══════════════════════════════════════
// Strategy Runtime Bridge
// ═══════════════════════════════════════

/**
 * Interface matching what Strategy Runtime's OrderContext calls.
 * ExecutionRuntime implements this and exposes via `orderContext`.
 */
export interface ExecutionOrderContext {
  marketBuy(symbol: string, quantity: number, strategyId?: string): Promise<string>
  marketSell(symbol: string, quantity: number, strategyId?: string): Promise<string>
  limitBuy(symbol: string, quantity: number, price: number, strategyId?: string): Promise<string>
  limitSell(symbol: string, quantity: number, price: number, strategyId?: string): Promise<string>
  cancel(orderId: string): Promise<boolean>
  getOrder(orderId: string): Order | undefined
  pendingOrders(): Order[]
  allOrders(): Order[]
}
