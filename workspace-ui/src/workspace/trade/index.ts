// ── Trade Domain: barrel ──

export { Trade, type TradeId, type TradeProps } from './Trade'
export { Order, type OrderId, type OrderProps } from './Order'
export {
  TradeStatus,
  TRADE_TRANSITIONS,
  BrokerOrderStatus,
  ORDER_TRANSITIONS,
  OrderSide,
  OrderType,
  TimeInForce,
  Direction,
  ExitReason,
  type Fee,
  type Fill,
  type EntryRecord,
  type ExitRecord,
  type TradeTimestamps,
  type FsmValidationResult,
} from './types'
export {
  TradeEventType,
  type TradeLifecycleEvent,
  type AnyTradeEvent,
  type TradeOpenedEvent,
  type TradeEntryPendingEvent,
  type TradeEntryFilledEvent,
  type TradeEntryPartialEvent,
  type TradeExitPendingEvent,
  type TradeExitPartialEvent,
  type TradeManagingEvent,
  type TradeClosedEvent,
  type TradeCancelledEvent,
  type TradeRejectedEvent,
  type TradeErroredEvent,
  type TradeModifiedEvent,
  type TradePnLUpdatedEvent,
  type OrderCreatedEvent,
  type OrderFilledEvent,
  type OrderPartiallyFilledEvent,
  type OrderCancelledEvent,
  type OrderRejectedEvent,
  type OrderExpiredEvent,
} from './TradeLifecycleEvent'
export {
  type TradeContext,
  type MarketSnapshot,
  type WalletSnapshot,
  type RiskSnapshot,
  type StrategyMeta,
  createTradeContext,
} from './TradeContext'
export { createTradeLifecycleEvent } from './runtime/event-factory'

// ── Runtime ──
export {
  TradeLifecycleRuntime,
  EntryController,
  ManageController,
  ExitController,
  RecoveryController,
  LifecycleEventBus,
  type TradeLifecycleOptions,
  type TradeSignal,
  type OrderEvent,
  type PlaceOrderRequest,
  type IOrderManager,
  type IExitEngine,
  type IRecoveryGateway,
  type PositionSnapshot,
  type ExitDecision,
  type EventHandler,
} from './runtime'

// ── Order Module (Sprint 5.3) ──
export {
  OrderManager,
  OrderTracker,
  OrderEventBus,
  FillAggregator,
  RetryEngine,
  TimeoutManager,
  ReplaceManager,
  OrderReconciler,
  OrderPersistence,
  InMemoryStore,
  OrderTrackerState,
  ORDER_TRACKER_TRANSITIONS,
  DEFAULT_TIMEOUT_SLA,
  type OrderManagerConfig,
  type AggregatedFill,
  type ReplaceResult,
  type IPersistenceStore,
  type PersistedOrder,
  type TimeoutConfig,
  type RetryAttempt,
  type RetryState,
} from './order'
