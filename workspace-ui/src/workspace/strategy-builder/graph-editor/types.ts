// ── Graph Editor Types ──
//
// Visual-only edge representation and graph-editor state.
// No domain logic — EdgeView does NOT replace StrategyEdge.
//
// @since 3.6.3

// ═══════════════════════════════════════
// Edge View Model
// ═══════════════════════════════════════

export type EdgeStyle = 'bezier' | 'orthogonal' | 'straight'

export interface EdgeViewModel {
  /** Edge ID (matches StrategyEdge.id) */
  id: string
  /** Source node ID */
  sourceId: string
  /** Source port ID */
  sourcePortId: string
  /** Target node ID */
  targetId: string
  /** Target port ID */
  targetPortId: string
  /** Visual style */
  style: EdgeStyle
  /** Bezier control points (computed) */
  controlPoints: { x: number; y: number }[]
  /** Whether edge is highlighted (on hover / selection) */
  highlighted: boolean
  /** Whether edge is selected */
  selected: boolean
  /** Whether edge is animated (execution pulse) */
  animated: boolean
  /** Label text */
  label?: string
  /** Condition expression (for conditional edges) */
  condition?: string
}

// ═══════════════════════════════════════
// Connection state (during drag)
// ═══════════════════════════════════════

export type ConnectionPhase =
  | 'idle'
  | 'dragging-from-port'
  | 'connecting'
  | 'valid-target'
  | 'reconnecting'

export interface ConnectionState {
  phase: ConnectionPhase
  /** Source node ID */
  sourceId: string | null
  /** Source port ID */
  sourcePortId: string | null
  /** Current pointer position (in graph coords) */
  cursorPosition: { x: number; y: number }
  /** Valid target node ID (when hovering over compatible port) */
  validTargetId: string | null
  /** Valid target port ID */
  validTargetPortId: string | null
}

// ═══════════════════════════════════════
// Connection candidate (from port to port)
// ═══════════════════════════════════════

export interface ConnectionCandidate {
  sourceNodeId: string
  sourcePortId: string
  targetNodeId: string
  targetPortId: string
}

// ═══════════════════════════════════════
// Layout node (AutoLayout)
// ═══════════════════════════════════════

export interface LayoutNode {
  id: string
  layer: number
  order: number
  x: number
  y: number
  width: number
  height: number
}

// ═══════════════════════════════════════
// Undo snapshot
// ═══════════════════════════════════════

import type { StrategyGraph } from '../../strategy/composition/types'

export interface GraphSnapshot {
  id: string
  label: string
  graph: StrategyGraph
  timestamp: number
}
