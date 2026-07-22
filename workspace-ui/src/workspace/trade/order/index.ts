// ── Order Manager: barrel ──

export { OrderManager, type OrderManagerConfig } from './OrderManager'
export { OrderTracker } from './OrderTracker'
export { OrderEventBus } from './events/OrderEventBus'
export { FillAggregator, type AggregatedFill } from './FillAggregator'
export { RetryEngine } from './RetryEngine'
export { TimeoutManager } from './TimeoutManager'
export { ReplaceManager, type ReplaceResult } from './ReplaceManager'
export { OrderReconciler } from './OrderReconciler'
export { OrderPersistence, InMemoryStore, type IPersistenceStore, type PersistedOrder } from './OrderPersistence'
export {
  OrderTrackerState,
  ORDER_TRACKER_TRANSITIONS,
  DEFAULT_TIMEOUT_SLA,
  type OrderTrackerState as OTS,
  type TimeoutConfig,
  type RetryAttempt,
  type RetryState,
} from './types'
