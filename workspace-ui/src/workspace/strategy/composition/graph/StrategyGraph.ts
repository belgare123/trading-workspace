// ── StrategyGraph — pure data container for strategy composition ──
//
// The graph is a DAG (Directed Acyclic Graph) where:
//   - Nodes are strategy steps (signal, condition, action)
//   - Edges define data flow (signal result → condition → action)
//
// GRAPH IS PURE DATA — no execution logic.
// All validation is in GraphValidator.
// All execution is in GraphRuntime.
//
// @since 3.4.6

import type { StrategyGraph as StrategyGraphData, StrategyNode, StrategyEdge, GraphMetadata } from '../types'

export class StrategyGraph {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly description?: string
  readonly nodes: StrategyNode[]
  readonly edges: StrategyEdge[]
  readonly metadata?: GraphMetadata
  readonly layout?: Record<string, unknown>

  constructor(data: StrategyGraphData) {
    this.id = data.id
    this.name = data.name
    this.version = data.version
    this.description = data.description
    this.nodes = [...data.nodes]
    this.edges = [...data.edges]
    this.metadata = data.metadata ? { ...data.metadata } : undefined
    this.layout = data.layout ? { ...data.layout } : undefined
  }

  /** Find a node by ID */
  getNode(id: string): StrategyNode | undefined {
    return this.nodes.find(n => n.id === id)
  }

  /** Find all nodes of a given type */
  getNodesByType(type: string): StrategyNode[] {
    return this.nodes.filter(n => n.type === type)
  }

  /** Find all edges from a node */
  getOutgoingEdges(nodeId: string): StrategyEdge[] {
    return this.edges.filter(e => e.sourceId === nodeId)
  }

  /** Find all edges into a node */
  getIncomingEdges(nodeId: string): StrategyEdge[] {
    return this.edges.filter(e => e.targetId === nodeId)
  }

  /** Get all successor node IDs */
  getSuccessors(nodeId: string): string[] {
    return this.getOutgoingEdges(nodeId).map(e => e.targetId)
  }

  /** Get all predecessor node IDs */
  getPredecessors(nodeId: string): string[] {
    return this.getIncomingEdges(nodeId).map(e => e.sourceId)
  }

  /** Number of nodes */
  get nodeCount(): number {
    return this.nodes.length
  }

  /** Number of edges */
  get edgeCount(): number {
    return this.edges.length
  }

  /** Convert to plain object */
  toJSON(): StrategyGraphData {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      nodes: this.nodes,
      edges: this.edges,
      metadata: this.metadata,
      layout: this.layout,
    }
  }

  /** Create a graph from plain data */
  static fromJSON(data: StrategyGraphData): StrategyGraph {
    return new StrategyGraph(data)
  }
}
