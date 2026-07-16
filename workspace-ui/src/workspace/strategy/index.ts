// ── Strategy Foundation barrel ──
//
// @since 3.4.1

export type {
  StrategyDefinition,
  StrategyContextBar,
  StrategyBar,
  ParameterSchema,
} from './definition'

export { StrategyRegistry } from './registry/StrategyRegistry'

export { StrategyRuntime } from './runtime/StrategyRuntime'

export { StrategyExecutor } from './executor/StrategyExecutor'
export type { BarFeed } from './executor/StrategyExecutor'

export type {
  StrategyStatus,
  SignalDirection,
  StrategySignal,
  StrategyInstanceData,
  StrategySummary,
} from './types'

// ── Execution Context (3.4.2) ──

export type {
  ExecutionContext,
  MarketContext, MarketTick, CandleData,
  OrderContext, OrderRequest, OrderResult, OrderSide, OrderType,
  PositionContext, PositionData,
  PortfolioContext, PortfolioSummary, BalanceData,
  TimeContext, TimeSession,
  IndicatorContext, MACDResult, BollingerResult,
} from './context'

// ── Signal Engine (3.4.3) ──

export type {
  SignalDefinition,
  SignalResult,
  SignalParameter,
} from './signals'

export { SignalRegistry as SignalSignalRegistry, SignalRuntime } from './signals'
export { registerAllSignals } from './signals'

// ── Condition Engine (3.4.4) ──

export type {
  ConditionResult,
  ConditionNode,
  ConditionInput,
  ConditionParameter,
  ConditionDefinition,
  ConditionEvaluationOutput,
} from './conditions'

export { ConditionRegistry, ConditionRuntime } from './conditions'
export { registerBuiltinConditions } from './conditions'

// ── Action Engine (3.4.5) ──

export type {
  ActionResult,
  ActionParameter,
  ActionLogEntry,
  ActionDefinition,
} from './actions'

export { ActionRegistry, ActionRuntime } from './actions'
export { registerBuiltinActions } from './actions'

// ── Composition Engine (3.4.6) ──

export type {
  NodeType,
  ScheduleEvent,
  StrategyNode,
  StrategyEdge,
  GraphMetadata,
  GraphBarData,
  GraphTickData,
  GraphExecutionContext,
  GraphExecutionResult,
  NodeExecutionResult,
  GraphExecutionError,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './composition'

export {
  StrategyGraph,
  createNode,
  createEdge,
  isExecutableNode,
  isVisualNode,
  buildAdjacencyList,
  buildReverseAdjacencyList,
  findRootNodes,
  findLeafNodes,
  GraphValidator,
  GraphScheduler,
  GraphExecutor,
  GraphRuntime,
  GraphSerializer,
  GraphMigration,
  GRAPH_SCHEMA,
  CURRENT_SCHEMA_VERSION,
} from './composition'
