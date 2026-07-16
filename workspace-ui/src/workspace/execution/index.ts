// ── Execution Module — Platform Subsystem v3.5.1 ──
//
// Execution Simulator Foundation: models order execution, fills,
// positions, and portfolio in a simulated environment.
//
// Usage:
//   const sim = new ExecutionRuntime()
//   sim.initialize({ initialCash: 10000, commissionModel: ..., ... })
//   sim.submitOrder({ symbol: 'BTC/USDT', side: 'buy', quantity: 1 })
//   sim.onBar(marketSnapshot)
//   sim.events.on('ORDER_FILLED', handler)
//
// @since 3.5.1

// ── Types ──
export type {
  OrderSide,
  OrderType,
  TimeInForce,
  OrderRequest,
  Order,
  Fill,
  FillResult,
  PositionDirection,
  Position,
  TradeRecord,
  CashBalance,
  EquitySnapshot,
  BarSnapshot,
  MarketSnapshot,
  FillModel,
  CommissionModel,
  SlippageModel,
  ExecutionConfig,
  ExecutionResult,
  ExecutionOrderContext,
} from './types'

export { OrderStatus } from './types'

// ── Events ──
export type {
  ExecutionEvent,
  OrderSubmittedEvent,
  OrderAcceptedEvent,
  OrderRejectedEvent,
  OrderFilledEvent,
  OrderPartiallyFilledEvent,
  OrderCancelledEvent,
  OrderExpiredEvent,
  PositionOpenedEvent,
  PositionUpdatedEvent,
  PositionClosedEvent,
  TradeRecordedEvent,
  EquityChangedEvent,
  EventHandler,
  ExecutionEventBus,
} from './events/ExecutionEvents'

export { ExecutionEventBus as ExecutionEventBusImpl } from './events/ExecutionEventBus'

// ── Orders ──
export { OrderBook } from './orders/OrderBook'
export { PendingOrders } from './orders/PendingOrders'
export { OrderMatcher } from './orders/OrderMatcher'
export {
  createOrder,
  acceptOrder,
  rejectOrder,
  fillOrder,
  cancelOrder,
  expireOrder,
  isActive,
  remainingQuantity,
} from './orders/OrderLifecycle'

// ── Fills ──
export { FillEngine } from './fills/FillEngine'
export type { FillPolicy } from './fills/FillPolicy'
export { FullFillPolicy, PartialFillPolicy } from './fills/FillPolicy'

// ── Slippage ──
export { NoSlippage, FixedSlippage, PercentageSlippage, VolumeBasedSlippage, slippageModels } from './fills/SlippageModel'

// ── Commission ──
export { ZeroCommission, FlatCommission, PercentageCommission, BinanceCommission, commissionModels } from './fills/CommissionModel'

// ── Positions ──
export { PositionLedger } from './positions/PositionLedger'
export { PositionRuntime } from './positions/PositionRuntime'
export { weightedAveragePrice, totalCost, scaledEntryCost } from './positions/AveragePrice'

// ── Ledger ──
export { TradeLedger } from './ledger/TradeLedger'
export { CashLedger } from './ledger/CashLedger'
export { EquityLedger } from './ledger/EquityLedger'

// ── Models ──
export { InstantFillModel } from './models/InstantFillModel'
export { BarCloseFillModel } from './models/BarCloseFillModel'
export { ReplayFillModel } from './models/ReplayFillModel'

// ── Definition ──
export type { ExecutionDefinition, ExecutionStatus } from './definition/ExecutionDefinition'

// ── Runtime ──
export { ExecutionRuntime } from './runtime/ExecutionRuntime'
