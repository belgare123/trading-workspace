// ── StrategyNode — individual graph node ──
//
// A node represents a single step in the strategy pipeline:
//   signal    → evaluates market data → SignalResult
//   condition → evaluates signal results → ConditionResult
//   action    → executes trade logic → ActionResult
//   group     → logical grouping (visual only)
//   comment   → documentation (visual only)
//
// @since 3.4.6

import type { StrategyNode, NodeType } from '../types'

// ── Factory ──

let _nodeCounter = 0

/** Create a new node for a graph */
export function createNode(
  type: NodeType,
  definitionId: string,
  label?: string,
  params?: Record<string, unknown>,
): StrategyNode {
  _nodeCounter++
  const id = `${type}_${_nodeCounter}`
  return {
    id,
    type,
    definitionId,
    label: label ?? `${type}:${definitionId}`,
    params: params ?? {},
  }
}

/** Reset the node counter (useful for testing) */
export function resetNodeCounter(): void {
  _nodeCounter = 0
}

// ── Helpers ──

/** Check if a node is executable (signal, condition, or action) */
export function isExecutableNode(node: StrategyNode): boolean {
  return node.type === 'signal' || node.type === 'condition' || node.type === 'action'
}

/** Check if a node is visual-only (group or comment) */
export function isVisualNode(node: StrategyNode): boolean {
  return node.type === 'group' || node.type === 'comment'
}

/** Get the node's runtime handler key */
export function getNodeHandlerKey(node: StrategyNode): string {
  return `${node.type}:${node.definitionId}`
}
