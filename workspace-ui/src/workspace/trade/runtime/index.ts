// ── Trade Runtime: barrel ──

export { TradeLifecycleRuntime, type TradeLifecycleOptions } from './TradeLifecycleRuntime'
export { EntryController } from './EntryController'
export { ManageController } from './ManageController'
export { ExitController } from './ExitController'
export { RecoveryController } from './RecoveryController'
export { LifecycleEventBus, type EventHandler } from './LifecycleEventBus'
export { createTradeLifecycleEvent } from './event-factory'
export type {
  TradeSignal,
  OrderEvent,
  PlaceOrderRequest,
  OrderEventType,
  OrderEventHandler,
  IOrderManager,
  IExitEngine,
  IRecoveryGateway,
  PositionSnapshot,
  ExitDecision,
} from './interfaces'
