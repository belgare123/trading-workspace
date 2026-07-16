// ── Composition types — core types for Strategy Composition Engine ──
//
// The Composition Engine is the orchestration layer that composes
// Signal, Condition, and Action engines into a directed graph.
//
// Graph is pure data — no execution logic.
// Runtime is pure execution — no UI.
//
// @since 3.4.6

// ── Node types ──

export type NodeType =
  | 'signal'
  | 'condition'
  | 'action'
  | 'group'
  | 'comment'

// ── Event types for scheduler ──

export type ScheduleEvent =
  | 'onBar'
  | 'onTick'
  | 'onTrade'
  | 'onTimer'
  | 'onNews'
  | 'onCustomEvent'

// ── Graph node ──

export interface StrategyNode {
  /** Unique node ID within the graph */
  id: string
  /** Node type — determines which runtime handles it */
  type: NodeType
  /** Human-readable label */
  label: string
  /** ID of the registered definition (signal/condition/action) */
  definitionId: string
  /** Parameters passed to the definition's evaluate/execute */
  params: Record<string, unknown>
  /** Position for visual editor */
  position?: { x: number; y: number }
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>
}

// ── Edge ──

export interface StrategyEdge {
  /** Unique edge ID */
  id: string
  /** Source node ID */
  sourceId: string
  /** Target node ID */
  targetId: string
  /** Optional label for display */
  label?: string
  /** Optional condition expression (future: conditional edges) */
  condition?: string
}

// ── Graph ──

export interface StrategyGraph {
  /** Unique graph ID */
  id: string
  /** Human-readable name */
  name: string
  /** Semantic version */
  version: string
  /** Optional description */
  description?: string
  /** Graph nodes */
  nodes: StrategyNode[]
  /** Graph edges */
  edges: StrategyEdge[]
  /** Graph-level metadata */
  metadata?: GraphMetadata
  /** Layout data for visual editor (opaque to runtime) */
  layout?: Record<string, unknown>
}

export interface GraphMetadata {
  created: number
  updated: number
  author?: string
  tags?: string[]
  schedule?: ScheduleEvent
}

// ── Execution context for graph runtime ──

/** Minimal bar data for graph execution */
export interface GraphBarData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  symbol?: string
}

/** Minimal tick data for graph execution */
export interface GraphTickData {
  timestamp: number
  price: number
  volume?: number
  symbol?: string
}

export interface GraphExecutionContext {
  /** Current bar data */
  bar?: GraphBarData
  /** Current tick data */
  tick?: GraphTickData
  /** Trade event data */
  trade?: Record<string, unknown>
  /** Custom event data */
  customEvent?: Record<string, unknown>
}

// ── Graph execution result ──

export interface GraphExecutionResult {
  /** Whether the entire graph executed successfully */
  success: boolean
  /** Per-node results keyed by node ID */
  nodeResults: Map<string, NodeExecutionResult>
  /** Execution timestamp */
  timestamp: number
  /** Duration in ms */
  duration: number
  /** Any errors encountered */
  errors: GraphExecutionError[]
}

export interface NodeExecutionResult {
  nodeId: string
  type: NodeType
  status: 'pending' | 'running' | 'success' | 'skipped' | 'error'
  result?: unknown
  error?: string
  duration: number
}

export interface GraphExecutionError {
  nodeId: string
  message: string
}
