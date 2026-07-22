// ── Trade Domain: Lifecycle Events ──

import type { Trade, TradeId } from './Trade'
import type { Order } from './Order'

// ════════════════════════════════════════
// Event type constants
// ════════════════════════════════════════

export const TradeEventType = {
  TradeOpened: 'trade:opened',
  TradeEntryPending: 'trade:entry-pending',
  TradeEntryFilled: 'trade:entry-filled',
  TradeEntryPartial: 'trade:entry-partial',
  TradeManaging: 'trade:managing',
  TradeExitPending: 'trade:exit-pending',
  TradeExitPartial: 'trade:exit-partial',
  TradeClosed: 'trade:closed',
  TradeCancelled: 'trade:cancelled',
  TradeRejected: 'trade:rejected',
  TradeErrored: 'trade:errored',
  TradeModified: 'trade:modified',
  TradePnLUpdated: 'trade:pnl-updated',
  OrderCreated: 'order:created',
  OrderFilled: 'order:filled',
  OrderPartiallyFilled: 'order:partially-filled',
  OrderCancelled: 'order:cancelled',
  OrderRejected: 'order:rejected',
  OrderExpired: 'order:expired',
} as const

export type TradeEventType = (typeof TradeEventType)[keyof typeof TradeEventType]

// ════════════════════════════════════════
// Base event
// ════════════════════════════════════════

export interface TradeLifecycleEvent {
  type: TradeEventType
  tradeId: string
  timestamp: number
  version: number
  correlationId?: string
}

// ════════════════════════════════════════
// Trade events
// ════════════════════════════════════════

export interface TradeOpenedEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.TradeOpened
  trade: ReturnType<Trade['toSnapshot']>
}

export interface TradeEntryPendingEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.TradeEntryPending
  tradeId: string
  orderId: string
}

export interface TradeEntryFilledEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.TradeEntryFilled
  tradeId: string
  entry: {
    price: number
    quantity: number
    quoteQuantity: number
    timestamp: number
  }
}

export interface TradeEntryPartialEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.TradeEntryPartial
  tradeId: string
  filledQuantity: number
  remainingQuantity: number
  averagePrice: number
}

export interface TradeManagingEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.TradeManaging
  tradeId: string
}

export interface TradeExitPendingEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.TradeExitPending
  tradeId: string
  orderId: string
  reason: string
}

export interface TradeExitPartialEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.TradeExitPartial
  tradeId: string
  exitedQuantity: number
  remainingQuantity: number
  reason: string
  pnl?: number
}

export interface TradeClosedEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.TradeClosed
  tradeId: string
  totalPnL: number
  totalFees: number
  holdTime: number
  exitReason: string
}

export interface TradeCancelledEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.TradeCancelled
  tradeId: string
  reason?: string
}

export interface TradeRejectedEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.TradeRejected
  tradeId: string
  reason?: string
}

export interface TradeErroredEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.TradeErrored
  tradeId: string
  error?: string
}

export interface TradeModifiedEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.TradeModified
  tradeId: string
  changes: Partial<{
    stopLoss: number
    takeProfit: number
    trailingStop: number
    metadata: Record<string, unknown>
  }>
}

export interface TradePnLUpdatedEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.TradePnLUpdated
  tradeId: string
  unrealizedPnL: number
  realizedPnL: number
  price: number
}

// ── Order events ──

export interface OrderCreatedEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.OrderCreated
  tradeId: string
  order: ReturnType<Order['toSnapshot']>
}

export interface OrderFilledEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.OrderFilled
  tradeId: string
  orderId: string
  fill: {
    price: number
    quantity: number
    quoteQuantity: number
    fee: { asset: string; amount: number; rate: number; currency: string }
  }
}

export interface OrderPartiallyFilledEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.OrderPartiallyFilled
  tradeId: string
  orderId: string
  filledQuantity: number
  remainingQuantity: number
  averagePrice: number
}

export interface OrderCancelledEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.OrderCancelled
  tradeId: string
  orderId: string
  reason?: string
}

export interface OrderRejectedEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.OrderRejected
  tradeId: string
  orderId: string
  reason?: string
}

export interface OrderExpiredEvent extends TradeLifecycleEvent {
  type: typeof TradeEventType.OrderExpired
  tradeId: string
  orderId: string
}

// ── Event union ──

export type AnyTradeEvent =
  | TradeOpenedEvent
  | TradeEntryPendingEvent
  | TradeEntryFilledEvent
  | TradeEntryPartialEvent
  | TradeExitPendingEvent
  | TradeExitPartialEvent
  | TradeClosedEvent
  | TradeCancelledEvent
  | TradeRejectedEvent
  | TradeErroredEvent
  | TradeModifiedEvent
  | TradePnLUpdatedEvent
  | OrderCreatedEvent
  | OrderFilledEvent
  | OrderPartiallyFilledEvent
  | OrderCancelledEvent
  | OrderRejectedEvent
  | OrderExpiredEvent
