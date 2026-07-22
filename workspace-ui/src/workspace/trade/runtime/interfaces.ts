// ── Trade Domain Runtime: Interfaces ──

import type { Order, OrderId } from '../Order'
import type { ExitReason, Direction, OrderType, TimeInForce, Fill } from '../types'
import type { MarketSnapshot } from '../../execution/types'
import type { TradeContext } from '../TradeContext'
import type { Trade } from '../Trade'

// ════════════════════════════════════════
// TradeSignal — what Strategy Runtime passes to TradeLifecycleRuntime.open()
// ════════════════════════════════════════

export interface TradeSignal {
  strategyId: string
  symbol: string
  direction: Direction
  price?: number
  stopLoss?: number
  takeProfit?: number
  type: OrderType
  quantity?: number
  timeInForce?: TimeInForce
  metadata?: Record<string, unknown>
}

// ════════════════════════════════════════
// OrderManager PlaceOrderRequest
// ════════════════════════════════════════

export interface PlaceOrderRequest {
  tradeId: string
  symbol: string
  side: 'buy' | 'sell'
  type: OrderType
  quantity: number
  price?: number
  stopPrice?: number
  reduceOnly?: boolean
  timeInForce?: TimeInForce
  clientOrderId?: string
  metadata?: Record<string, unknown>
}

// ════════════════════════════════════════
// Order events emitted by IOrderManager.eventBus
// ════════════════════════════════════════

export const OrderEventType = {
  OrderCreated:  'OrderCreated',
  OrderAccepted: 'OrderAccepted',
  OrderWorking:  'OrderWorking',
  OrderPartial:  'OrderPartial',
  OrderFilled:   'OrderFilled',
  OrderCancelled:'OrderCancelled',
  OrderRejected: 'OrderRejected',
  OrderExpired:  'OrderExpired',
  OrderReplaced: 'OrderReplaced',
} as const

export type OrderEventType = (typeof OrderEventType)[keyof typeof OrderEventType]

export type OrderEvent =
  | { type: typeof OrderEventType.OrderCreated;  order: Order; timestamp: number }
  | { type: typeof OrderEventType.OrderAccepted; order: Order; timestamp: number }
  | { type: typeof OrderEventType.OrderWorking;  order: Order; timestamp: number }
  | { type: typeof OrderEventType.OrderPartial;  order: Order; fill: Fill; timestamp: number }
  | { type: typeof OrderEventType.OrderFilled;   order: Order; fill: Fill; timestamp: number }
  | { type: typeof OrderEventType.OrderCancelled;order: Order; timestamp: number }
  | { type: typeof OrderEventType.OrderRejected; order: Order; reason: string; timestamp: number }
  | { type: typeof OrderEventType.OrderExpired;  order: Order; timestamp: number }
  | { type: typeof OrderEventType.OrderReplaced; order: Order; replacedBy: string; timestamp: number }

export type OrderEventHandler = (event: OrderEvent) => void

// ════════════════════════════════════════
// IOrderManager — фасад исполнения ордеров
// ════════════════════════════════════════

export interface IOrderManager {
  create(request: PlaceOrderRequest): Promise<Order>
  cancel(orderId: string): Promise<void>
  replace(orderId: string, request: Partial<PlaceOrderRequest>): Promise<Order>
  amend(orderId: string, request: Partial<PlaceOrderRequest>): Promise<Order>
  get(orderId: string): Order | undefined
  list(tradeId?: string): Order[]
  recover(): Promise<void>
  shutdown(): void

  /** Subscribe to order lifecycle events */
  on(eventType: OrderEventType | '*', handler: OrderEventHandler): () => void
  /** Unsubscribe from order lifecycle events */
  off(eventType: OrderEventType | '*', handler: OrderEventHandler): void
}

// ════════════════════════════════════════
// ExitDecision — what ExitEngine returns
// ════════════════════════════════════════

export interface ExitDecision {
  reason: ExitReason
  exitPrice: number
  exitType: 'market' | 'limit'
  quantity: 'all' | number
  priority: number
}

// ════════════════════════════════════════
// IExitEngine — thin (Sprint 5.4)
// ════════════════════════════════════════

export interface IExitEngine {
  evaluate(context: TradeContext): ExitDecision | null
}

// ════════════════════════════════════════
// Position snapshot (from Gateway, for Recovery)
// ════════════════════════════════════════

export interface PositionSnapshot {
  symbol: string
  direction: 'long' | 'short'
  quantity: number
  averageEntryPrice: number
  currentPrice: number
  unrealizedPnl: number
  realizedPnl: number
}

export interface IRecoveryGateway {
  getPositions(): Promise<PositionSnapshot[]>
  getOrders(): Promise<{ orderId: string; symbol: string; side: 'buy' | 'sell'; quantity: number; price?: number; status: string }[]>
}
