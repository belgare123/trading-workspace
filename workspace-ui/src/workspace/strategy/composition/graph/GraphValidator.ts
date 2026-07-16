// ── GraphValidator — validates strategy graph integrity ──
//
// Checks performed:
//   1. No duplicate node IDs
//   2. No duplicate edge IDs
//   3. All edge source/target IDs reference existing nodes
//   4. No cycles (graph must be a DAG)
//   5. At least one action node exists
//   6. At least one signal node exists (as data source)
//   7. No dangling edges (all references resolve)
//   8. Comment/group nodes have no edges
//   9. No start node? — root nodes must be signal nodes
//
// @since 3.4.6

import type { StrategyGraph, StrategyNode, StrategyEdge } from '../types'
import { isExecutableNode } from './StrategyNode'

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

export interface ValidationWarning {
  code: string
  message: string
  nodeId?: string
}

export class GraphValidator {
  /**
   * Validate a strategy graph.
   * Returns { valid, errors, warnings }.
   */
  static validate(graph: StrategyGraph): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // 1. Duplicate node IDs
    const nodeIds = new Set<string>()
    for (const node of graph.nodes) {
      if (nodeIds.has(node.id)) {
        errors.push({ code: 'DUPLICATE_NODE_ID', message: `Duplicate node ID: ${node.id}`, nodeId: node.id })
      }
      nodeIds.add(node.id)
    }

    // 2. Duplicate edge IDs
    const edgeIds = new Set<string>()
    for (const edge of graph.edges) {
      if (edgeIds.has(edge.id)) {
        errors.push({ code: 'DUPLICATE_EDGE_ID', message: `Duplicate edge ID: ${edge.id}`, edgeId: edge.id })
      }
      edgeIds.add(edge.id)
    }

    // 3. Edge references resolve
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.sourceId)) {
        errors.push({ code: 'EDGE_SOURCE_NOT_FOUND', message: `Edge ${edge.id}: source node '${edge.sourceId}' not found`, edgeId: edge.id })
      }
      if (!nodeIds.has(edge.targetId)) {
        errors.push({ code: 'EDGE_TARGET_NOT_FOUND', message: `Edge ${edge.id}: target node '${edge.targetId}' not found`, edgeId: edge.id })
      }
    }

    // 4. Check cycles via DFS
    const cycleNodes = GraphValidator._findCycleNodes(graph.nodes, graph.edges)
    for (const nodeId of cycleNodes) {
      errors.push({ code: 'CYCLE_DETECTED', message: `Cycle detected involving node: ${nodeId}`, nodeId })
    }

    // 5. At least one action node
    const actionNodes = graph.nodes.filter(n => n.type === 'action')
    if (actionNodes.length === 0) {
      errors.push({ code: 'NO_ACTION_NODE', message: 'Graph must contain at least one action node' })
    }

    // 6. At least one signal node
    const signalNodes = graph.nodes.filter(n => n.type === 'signal')
    if (signalNodes.length === 0) {
      errors.push({ code: 'NO_SIGNAL_NODE', message: 'Graph must contain at least one signal node as data source' })
    }

    // 7. Visual nodes should not have edges
    for (const edge of graph.edges) {
      const sourceNode = graph.nodes.find(n => n.id === edge.sourceId)
      const targetNode = graph.nodes.find(n => n.id === edge.targetId)
      if (sourceNode && !isExecutableNode(sourceNode)) {
        warnings.push({ code: 'VISUAL_NODE_HAS_EDGE', message: `Visual node '${sourceNode.id}' has outgoing edges — they will be ignored`, nodeId: sourceNode.id })
      }
      if (targetNode && !isExecutableNode(targetNode)) {
        warnings.push({ code: 'VISUAL_NODE_HAS_EDGE', message: `Visual node '${targetNode.id}' has incoming edges — they will be ignored`, nodeId: targetNode.id })
      }
    }

    // 8. All root nodes should be signal nodes
    const rootNodes = graph.nodes.filter(n => {
      const hasIncoming = graph.edges.some(e => e.targetId === n.id)
      return !hasIncoming && isExecutableNode(n)
    })
    for (const root of rootNodes) {
      if (root.type !== 'signal') {
        warnings.push({ code: 'NON_SIGNAL_ROOT', message: `Root node '${root.id}' is not a signal — ensure it has data inputs`, nodeId: root.id })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Detect cycles using DFS.
   * Returns IDs of nodes that are part of cycles.
   */
  private static _findCycleNodes(
    nodes: StrategyNode[],
    edges: StrategyEdge[],
  ): string[] {
    const adj = new Map<string, string[]>()
    for (const node of nodes) {
      adj.set(node.id, [])
    }
    for (const edge of edges) {
      adj.get(edge.sourceId)?.push(edge.targetId)
    }

    const WHITE = 0, GRAY = 1, BLACK = 2
    const color = new Map<string, number>()
    for (const node of nodes) color.set(node.id, WHITE)

    const inCycle = new Set<string>()

    function dfs(u: string): boolean {
      color.set(u, GRAY)
      for (const v of adj.get(u) ?? []) {
        if (color.get(v) === GRAY) {
          inCycle.add(u)
          inCycle.add(v)
          return true
        }
        if (color.get(v) === WHITE && dfs(v)) {
          inCycle.add(u)
          return true
        }
      }
      color.set(u, BLACK)
      return false
    }

    for (const node of nodes) {
      if (color.get(node.id) === WHITE) {
        dfs(node.id)
      }
    }

    return [...inCycle]
  }
}
