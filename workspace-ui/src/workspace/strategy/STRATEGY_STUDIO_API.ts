// ── STRATEGY_STUDIO_API — Frozen Public API Contract v1.0 ──
//
// This file defines the official public API surface of Strategy Studio.
// All external consumers (Execution Simulator, Metrics Runtime, Dashboard,
// Visual Builder, Marketplace, AI Generator) interact with Strategy Studio
// ONLY through this API.
//
// Any change to this contract requires a new major version.
//
// @since 3.4.6
// @version 1.0.0

// ═══════════════════════════════════════════
// Core — Strategy Lifecycle
// ═══════════════════════════════════════════

export type {
  // Definition
  StrategyDefinition,
  StrategyContextBar,
  StrategyBar,
  ParameterSchema,
} from './definition'

export type {
  StrategyStatus,
  SignalDirection,
  StrategySignal,
  StrategyInstanceData,
  StrategySummary,
} from './types'

export { StrategyRegistry } from './registry/StrategyRegistry'
export { StrategyRuntime } from './runtime/StrategyRuntime'
export { StrategyExecutor } from './executor/StrategyExecutor'
export type { BarFeed } from './executor/StrategyExecutor'

// ═══════════════════════════════════════════
// Execution Context
// ═══════════════════════════════════════════

export type {
  ExecutionContext,
  MarketContext,
  MarketTick,
  CandleData,
  OrderContext,
  OrderRequest,
  OrderResult,
  OrderSide,
  OrderType,
  PositionContext,
  PositionData,
  PortfolioContext,
  PortfolioSummary,
  BalanceData,
  TimeContext,
  TimeSession,
  IndicatorContext,
} from './context'

// ═══════════════════════════════════════════
// Signal Engine
// ═══════════════════════════════════════════

export type {
  SignalDefinition,
  SignalParameter,
  SignalResult,
} from './signals'

export {
  SignalRegistry,
  SignalRuntime,
} from './signals'

// ═══════════════════════════════════════════
// Condition Engine
// ═══════════════════════════════════════════

export type {
  ConditionResult,
  ConditionNode,
  ConditionInput,
  ConditionParameter,
  ConditionDefinition,
  ConditionEvaluationOutput,
} from './conditions'

export {
  ConditionRegistry,
  ConditionRuntime,
} from './conditions'

// ═══════════════════════════════════════════
// Action Engine
// ═══════════════════════════════════════════

export type {
  ActionResult,
  ActionParameter,
  ActionLogEntry,
  ActionDefinition,
} from './actions'

export {
  ActionRegistry,
  ActionRuntime,
} from './actions'

// ═══════════════════════════════════════════
// Composition Engine (Strategy Graph)
// ═══════════════════════════════════════════

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

// ═══════════════════════════════════════════
// API Descriptor — for tooling, documentation, and introspection
// ═══════════════════════════════════════════

/**
 * Strategy Studio Public API descriptor.
 *
 * This object is NOT the implementation — it's a machine-readable
 * manifest of the frozen API surface. Used by:
 *   - Documentation generators
 *   - Integration tests (API drift detection)
 *   - Marketplace plugin validation
 *   - Visual Builder contract verification
 */
export const STRATEGY_STUDIO_API = {
  version: '1.0.0',
  frozen: true,

  core: {
    runtime: 'StrategyRuntime',
    executor: 'StrategyExecutor',
    context: 'ExecutionContext',
    registry: 'StrategyRegistry',
  },

  registries: [
    'StrategyRegistry',
    'SignalRegistry',
    'ConditionRegistry',
    'ActionRegistry',
  ] as const,

  runtimes: [
    'StrategyRuntime',
    'SignalRuntime',
    'ConditionRuntime',
    'ActionRuntime',
  ] as const,

  composition: [
    'GraphRuntime',
    'GraphExecutor',
    'GraphScheduler',
    'GraphValidator',
    'GraphSerializer',
    'GraphMigration',
  ] as const,

  definitionTypes: [
    'StrategyDefinition',
    'SignalDefinition',
    'ConditionDefinition',
    'ActionDefinition',
  ] as const,

  /** Frozen source paths — used by CI to detect unauthorized changes */
  frozenPaths: [
    'strategy/definition/',
    'strategy/runtime/',
    'strategy/executor/',
    'strategy/context/',
    'strategy/signals/definition/',
    'strategy/signals/registry/',
    'strategy/signals/runtime/',
    'strategy/conditions/definition/',
    'strategy/conditions/registry/',
    'strategy/conditions/runtime/',
    'strategy/actions/definition/',
    'strategy/actions/registry/',
    'strategy/actions/runtime/',
    'strategy/composition/runtime/',
    'strategy/composition/graph/GraphValidator.ts',
    'strategy/composition/serialization/',
  ] as const,
} as const
