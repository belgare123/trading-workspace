// ── Composition Engine barrel ──
// Sprint 3.4.6 — Strategy Composition Engine
//
// @since 3.4.6

// Types
export type {
  NodeType,
  ScheduleEvent,
  StrategyNode,
  StrategyEdge,
  StrategyGraph as StrategyGraphData,
  GraphMetadata,
  GraphBarData,
  GraphTickData,
  GraphExecutionContext,
  GraphExecutionResult,
  NodeExecutionResult,
  GraphExecutionError,
} from './types'

// Graph (pure data)
export { StrategyGraph } from './graph/StrategyGraph'
export {
  createNode,
  resetNodeCounter,
  isExecutableNode,
  isVisualNode,
  getNodeHandlerKey,
} from './graph/StrategyNode'
export type { StrategyNode as StrategyNodeType } from './types'
export {
  createEdge,
  resetEdgeCounter,
  buildAdjacencyList,
  buildReverseAdjacencyList,
  findRootNodes,
  findLeafNodes,
} from './graph/StrategyEdge'
export { GraphValidator } from './graph/GraphValidator'
export type { ValidationResult, ValidationError, ValidationWarning } from './graph/GraphValidator'

// Runtime
export { GraphScheduler } from './runtime/GraphScheduler'
export type { ScheduleHandler } from './runtime/GraphScheduler'
export { GraphExecutor } from './runtime/GraphExecutor'
export { GraphRuntime } from './runtime/GraphRuntime'

// Serialization
export { GraphSerializer } from './serialization/GraphSerializer'
export { GraphMigration } from './serialization/GraphMigration'
export { GRAPH_SCHEMA, CURRENT_SCHEMA_VERSION } from './serialization/GraphSchema'
