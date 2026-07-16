// ── ExecutionEvents — first-class event types for Execution Simulator ──
//
// Every state change in the simulation emits an event.
// Metrics Runtime and Backtest Session subscribe to these.
//
// @since 3.5.1

import type { Order, Fill, Position, TradeRecord, EquitySnapshot } from '../types'

export type ExecutionEvent =
  | OrderSubmittedEvent
  | OrderAcceptedEvent
  | OrderRejectedEvent
  | OrderFilledEvent
  | OrderPartiallyFilledEvent
  | OrderCancelledEvent
  | OrderExpiredEvent
  | PositionOpenedEvent
  | PositionUpdatedEvent
  | PositionClosedEvent
  | TradeRecordedEvent
  | EquityChangedEvent

// ── Order Events ──

export interface OrderSubmittedEvent {
  type: 'ORDER_SUBMITTED'
  order: Order
  timestamp: number
}

export interface OrderAcceptedEvent {
  type: 'ORDER_ACCEPTED'
  order: Order
  timestamp: number
}

export interface OrderRejectedEvent {
  type: 'ORDER_REJECTED'
  order: Order
  reason: string
  timestamp: number
}

export interface OrderFilledEvent {
  type: 'ORDER_FILLED'
  order: Order
  fill: Fill
  timestamp: number
}

export interface OrderPartiallyFilledEvent {
  type: 'ORDER_PARTIALLY_FILLED'
  order: Order
  fill: Fill
  remainingQuantity: number
  timestamp: number
}

export interface OrderCancelledEvent {
  type: 'ORDER_CANCELLED'
  order: Order
  timestamp: number
}

export interface OrderExpiredEvent {
  type: 'ORDER_EXPIRED'
  order: Order
  timestamp: number
}

// ── Position Events ──

export interface PositionOpenedEvent {
  type: 'POSITION_OPENED'
  position: Position
  timestamp: number
}

export interface PositionUpdatedEvent {
  type: 'POSITION_UPDATED'
  position: Position
  previousPosition?: Position
  timestamp: number
}

export interface PositionClosedEvent {
  type: 'POSITION_CLOSED'
  position: Position
  realizedPnl: number
  timestamp: number
}

// ── Ledger Events ──

export interface TradeRecordedEvent {
  type: 'TRADE_RECORDED'
  trade: TradeRecord
  timestamp: number
}

export interface EquityChangedEvent {
  type: 'EQUITY_CHANGED'
  equity: EquitySnapshot
  previousEquity?: EquitySnapshot
  timestamp: number
}

// ── Event Bus Interface ──

export type EventHandler = (event: ExecutionEvent) => void

export interface ExecutionEventBus {
  /** Subscribe to all events. Returns unsubscribe function. */
  subscribe(handler: EventHandler): () => void

  /** Subscribe to events of a specific type. Returns unsubscribe function. */
  on<K extends ExecutionEvent['type']>(
    type: K,
    handler: (event: Extract<ExecutionEvent, { type: K }>) => void,
  ): () => void

  /** Emit one event to all subscribers */
  emit(event: ExecutionEvent): void

  /** Clear all subscriptions */
  clear(): void

  /** Number of active subscribers */
  subscriberCount(): number
}
