// ── StrategyEdge — connection between two nodes ──
//
// Edges define the data flow direction in the strategy graph.
// An edge from node A to node B means A's output feeds into B's input.
//
// @since 3.4.6

import type { StrategyEdge, StrategyNode } from '../types'

// ── Factory ──

let _edgeCounter = 0

/** Create a new edge between two nodes */
export function createEdge(
  sourceId: string,
  targetId: string,
  label?: string,
): StrategyEdge {
  _edgeCounter++
  return {
    id: `edge_${_edgeCounter}`,
    sourceId,
    targetId,
    label,
  }
}

/** Reset the edge counter */
export function resetEdgeCounter(): void {
  _edgeCounter = 0
}

// ── Topology helpers ──

/**
 * Build an adjacency list from nodes and edges.
 * Returns Map<nodeId, targetNodeId[]> (forward edges).
 */
export function buildAdjacencyList(
  nodes: StrategyNode[],
  edges: StrategyEdge[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const node of nodes) {
    adj.set(node.id, [])
  }
  for (const edge of edges) {
    const targets = adj.get(edge.sourceId)
    if (targets) {
      targets.push(edge.targetId)
    }
  }
  return adj
}

/**
 * Build reverse adjacency list (incoming edges).
 * Returns Map<nodeId, sourceNodeId[]>.
 */
export function buildReverseAdjacencyList(
  nodes: StrategyNode[],
  edges: StrategyEdge[],
): Map<string, string[]> {
  const rev = new Map<string, string[]>()
  for (const node of nodes) {
    rev.set(node.id, [])
  }
  for (const edge of edges) {
    const sources = rev.get(edge.targetId)
    if (sources) {
      sources.push(edge.sourceId)
    }
  }
  return rev
}

/**
 * Find all source nodes (no incoming edges).
 */
export function findRootNodes(
  nodes: StrategyNode[],
  edges: StrategyEdge[],
): StrategyNode[] {
  const rev = buildReverseAdjacencyList(nodes, edges)
  return nodes.filter(n => (rev.get(n.id)?.length ?? 0) === 0)
}

/**
 * Find all leaf nodes (no outgoing edges).
 */
export function findLeafNodes(
  nodes: StrategyNode[],
  edges: StrategyEdge[],
): StrategyNode[] {
  const adj = buildAdjacencyList(nodes, edges)
  return nodes.filter(n => (adj.get(n.id)?.length ?? 0) === 0)
}
