// ── Trade Domain: types ──

// ════════════════════════════════════════
// Trade Status (FSM)
// ════════════════════════════════════════

export const TradeStatus = {
  Created: 'created',
  EntryPending: 'entry-pending',
  EntryPartial: 'entry-partial',
  EntryFilled: 'entry-filled',
  Managing: 'managing',
  ExitPending: 'exit-pending',
  ExitPartial: 'exit-partial',
  Closed: 'closed',
  Cancelled: 'cancelled',
  Rejected: 'rejected',
  Errored: 'errored',
} as const

export type TradeStatus = (typeof TradeStatus)[keyof typeof TradeStatus]

/** Allowed FSM transitions for Trade */
export const TRADE_TRANSITIONS: Record<TradeStatus, readonly TradeStatus[]> = {
  [TradeStatus.Created]: [TradeStatus.EntryPending, TradeStatus.Rejected, TradeStatus.Cancelled],
  [TradeStatus.EntryPending]: [TradeStatus.EntryPartial, TradeStatus.EntryFilled, TradeStatus.Cancelled, TradeStatus.Rejected],
  [TradeStatus.EntryPartial]: [TradeStatus.EntryFilled, TradeStatus.EntryPending, TradeStatus.Cancelled],
  [TradeStatus.EntryFilled]: [TradeStatus.Managing, TradeStatus.ExitPending],
  [TradeStatus.Managing]: [TradeStatus.ExitPending, TradeStatus.ExitPartial, TradeStatus.Closed],
  [TradeStatus.ExitPending]: [TradeStatus.ExitPartial, TradeStatus.Closed, TradeStatus.Cancelled],
  [TradeStatus.ExitPartial]: [TradeStatus.ExitPending, TradeStatus.Closed],
  [TradeStatus.Closed]: [],
  [TradeStatus.Cancelled]: [],
  [TradeStatus.Rejected]: [],
  [TradeStatus.Errored]: [TradeStatus.Cancelled],
}

// ════════════════════════════════════════
// Order Status (FSM)
// ════════════════════════════════════════

export const BrokerOrderStatus = {
  New: 'new',
  Submitted: 'submitted',
  Accepted: 'accepted',
  Working: 'working',
  PartialFill: 'partial-fill',
  Filled: 'filled',
  Cancelled: 'cancelled',
  Rejected: 'rejected',
  Expired: 'expired',
} as const

export type BrokerOrderStatus = (typeof BrokerOrderStatus)[keyof typeof BrokerOrderStatus]

/** Allowed FSM transitions for Order */
export const ORDER_TRANSITIONS: Record<BrokerOrderStatus, readonly BrokerOrderStatus[]> = {
  [BrokerOrderStatus.New]: [BrokerOrderStatus.Submitted, BrokerOrderStatus.Rejected],
  [BrokerOrderStatus.Submitted]: [BrokerOrderStatus.Accepted, BrokerOrderStatus.Rejected],
  [BrokerOrderStatus.Accepted]: [BrokerOrderStatus.Working, BrokerOrderStatus.Filled, BrokerOrderStatus.Cancelled, BrokerOrderStatus.Rejected],
  [BrokerOrderStatus.Working]: [BrokerOrderStatus.PartialFill, BrokerOrderStatus.Filled, BrokerOrderStatus.Cancelled, BrokerOrderStatus.Expired],
  [BrokerOrderStatus.PartialFill]: [BrokerOrderStatus.Filled, BrokerOrderStatus.Working, BrokerOrderStatus.Cancelled],
  [BrokerOrderStatus.Filled]: [],
  [BrokerOrderStatus.Cancelled]: [],
  [BrokerOrderStatus.Rejected]: [],
  [BrokerOrderStatus.Expired]: [],
}

// ════════════════════════════════════════
// Side, Type, TimeInForce
// ════════════════════════════════════════

export const OrderSide = {
  Buy: 'buy',
  Sell: 'sell',
} as const

export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide]

export const OrderType = {
  Market: 'market',
  Limit: 'limit',
  Stop: 'stop',
  StopLimit: 'stop-limit',
} as const

export type OrderType = (typeof OrderType)[keyof typeof OrderType]

export const TimeInForce = {
  GTC: 'gtc',
  IOC: 'ioc',
  FOK: 'fok',
  PostOnly: 'post-only',
} as const

export type TimeInForce = (typeof TimeInForce)[keyof typeof TimeInForce]

// ════════════════════════════════════════
// Direction (Trade)
// ════════════════════════════════════════

export const Direction = {
  Long: 'long',
  Short: 'short',
} as const

export type Direction = (typeof Direction)[keyof typeof Direction]

// ════════════════════════════════════════
// Fee model
// ════════════════════════════════════════

export interface Fee {
  asset: string
  amount: number
  rate: number
  currency: string
}

// ════════════════════════════════════════
// Fill model
// ════════════════════════════════════════

export interface Fill {
  id: string
  orderId: string
  tradeId?: string
  symbol: string
  side: OrderSide
  price: number
  quantity: number
  quoteQuantity: number
  fee: Fee
  timestamp: number
  brokerFillId?: string
}

// ════════════════════════════════════════
// Entry / Exit records
// ════════════════════════════════════════

export interface EntryRecord {
  price: number
  quantity: number
  quoteQuantity: number
  timestamp: number
  orderId: string
  signalId?: string
  reason?: string
}

export interface ExitRecord {
  price: number
  quantity: number
  quoteQuantity: number
  timestamp: number
  orderId: string
  reason: ExitReason
  pnl?: number
  pnlPct?: number
}

export const ExitReason = {
  TakeProfit: 'take-profit',
  StopLoss: 'stop-loss',
  TrailingStop: 'trailing-stop',
  TimeExit: 'time-exit',
  EmergencyExit: 'emergency-exit',
  ForceExit: 'force-exit',
  ManualExit: 'manual-exit',
  PartialExit: 'partial-exit',
  SignalExit: 'signal-exit',
} as const

export type ExitReason = (typeof ExitReason)[keyof typeof ExitReason]

// ════════════════════════════════════════
// Metadata
// ════════════════════════════════════════

export interface TradeTimestamps {
  created: number
  entrySent?: number
  entryFilled?: number
  managing?: number
  exitSent?: number
  exitFilled?: number
  closed?: number
  updated: number
}

/** FSM validation result */
export interface FsmValidationResult {
  valid: boolean
  from: string
  to: string
  allowedTransitions: readonly string[]
  message?: string
}
