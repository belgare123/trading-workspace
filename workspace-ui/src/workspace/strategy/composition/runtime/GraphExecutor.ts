// ── GraphExecutor — topological execution of strategy graphs ──
//
// Executes a strategy graph by:
//   1. Topologically sorting nodes (Kahn's algorithm)
//   2. Executing each node when all its dependencies are resolved
//   3. Propagating results through edges
//
// Execution per node type:
//   signal    → SignalRegistry.get(defId).evaluate(ctx, params)
//   condition → ConditionRegistry.get(defId).evaluate({ ctx, params, childResults, nodeState })
//   action    → ActionRuntime.execute(actionId, ctx, params)
//
// @since 3.4.6

import type { StrategyGraph, StrategyNode } from '../types'
import type { GraphExecutionContext, GraphExecutionResult, NodeExecutionResult, GraphExecutionError } from '../types'
import { isExecutableNode } from '../graph/StrategyNode'
import { buildAdjacencyList, buildReverseAdjacencyList } from '../graph/StrategyEdge'

import { SignalRegistry } from '../../signals'
import { ConditionRegistry } from '../../conditions'
import { ActionRuntime } from '../../actions'
import type { ExecutionContext } from '../../context'

export class GraphExecutor {
  private readonly _actionRuntime: ActionRuntime
  private readonly _conditionStates = new Map<string, unknown>()

  constructor(
    actionRuntime: ActionRuntime,
  ) {
    this._actionRuntime = actionRuntime
  }

  /**
   * Execute a strategy graph.
   * Returns per-node results with timing and error info.
   */
  async execute(
    graph: StrategyGraph,
    ctx: ExecutionContext,
    _eventCtx?: GraphExecutionContext,
  ): Promise<GraphExecutionResult> {
    const startTime = Date.now()
    const nodeResults = new Map<string, NodeExecutionResult>()
    const errors: GraphExecutionError[] = []

    // Get topological order
    const order = this._topologicalSort(graph)
    if (order.length === 0) {
      return {
        success: false,
        nodeResults,
        timestamp: startTime,
        duration: 0,
        errors: [{ nodeId: 'graph', message: 'No executable nodes in graph (cycle or empty)' }],
      }
    }

    // Build reverse adjacency for result propagation
    const rev = buildReverseAdjacencyList(graph.nodes, graph.edges)

    // Execute nodes in topological order
    for (const node of order) {
      if (!isExecutableNode(node)) {
        nodeResults.set(node.id, { nodeId: node.id, type: node.type, status: 'skipped', duration: 0 })
        continue
      }

      const nodeStart = Date.now()

      try {
        // Collect incoming edge results
        const incomingSources = rev.get(node.id) ?? []
        const incomingResults = incomingSources
          .map(srcId => nodeResults.get(srcId))
          .filter((r): r is NodeExecutionResult => r !== undefined)

        // Get stored node state for stateful conditions
        const nodeState = this._conditionStates.get(node.id)

        let resultPromise: Promise<unknown>

        switch (node.type) {
          case 'signal': {
            resultPromise = this._execSignal(node, ctx)
            break
          }
          case 'condition': {
            resultPromise = this._execCondition(node, ctx, incomingResults, nodeState)
            break
          }
          case 'action': {
            resultPromise = this._execAction(node, ctx, incomingResults)
            break
          }
          default:
            resultPromise = Promise.resolve(null)
        }

        const result = await resultPromise

        // Store updated node state for conditions
        if (node.type === 'condition' && result && typeof result === 'object' && 'nextState' in result) {
          const typedResult = result as { nextState?: Record<string, unknown> }
          if (typedResult.nextState !== undefined) {
            this._conditionStates.set(node.id, typedResult.nextState)
          }
        }

        nodeResults.set(node.id, {
          nodeId: node.id,
          type: node.type,
          status: 'success',
          result,
          duration: Date.now() - nodeStart,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        nodeResults.set(node.id, {
          nodeId: node.id,
          type: node.type,
          status: 'error',
          error: msg,
          duration: Date.now() - nodeStart,
        })
        errors.push({ nodeId: node.id, message: msg })
      }
    }

    return {
      success: errors.length === 0,
      nodeResults,
      timestamp: startTime,
      duration: Date.now() - startTime,
      errors,
    }
  }

  /** Get stored condition state (for testing / inspection) */
  getConditionState(nodeId: string): unknown {
    return this._conditionStates.get(nodeId)
  }

  /** Clear all stored condition states */
  clearConditionStates(): void {
    this._conditionStates.clear()
  }

  // ── Private: execute a signal node ──

  private async _execSignal(
    node: StrategyNode,
    ctx: ExecutionContext,
  ): Promise<unknown> {
    const def = SignalRegistry.getInstance().get(node.definitionId)
    if (!def) {
      throw new Error(`Signal definition not found: ${node.definitionId}`)
    }
    return def.evaluate(ctx, node.params)
  }

  // ── Private: execute a condition node ──

  private async _execCondition(
    node: StrategyNode,
    ctx: ExecutionContext,
    incomingResults: NodeExecutionResult[],
    nodeState: unknown,
  ): Promise<unknown> {
    const def = ConditionRegistry.getInstance().get(node.definitionId)
    if (!def) {
      throw new Error(`Condition definition not found: ${node.definitionId}`)
    }

    // Collect child results from incoming edges
    const childResults = incomingResults
      .filter(r => r.result && typeof r.result === 'object' && 'satisfied' in (r.result as Record<string, unknown>))
      .map(r => (r.result as { satisfied: boolean; score?: number; reason?: string; matchedSignals?: string[] }))

    return def.evaluate({
      ctx,
      params: { ...node.params },
      childResults,
      signalResults: new Map(),
      nodeState: (nodeState ?? {}) as Record<string, unknown>,
    })
  }

  // ── Private: execute an action node ──

  private async _execAction(
    node: StrategyNode,
    ctx: ExecutionContext,
    incomingResults: NodeExecutionResult[],
  ): Promise<unknown> {
    // Check if incoming conditions are satisfied
    const incomingConditions = incomingResults.filter(r => r.type === 'condition')
    if (incomingConditions.length > 0) {
      const allSatisfied = incomingConditions.every(r => {
        const res = r.result as { satisfied?: boolean } | undefined
        return res?.satisfied === true
      })
      if (!allSatisfied) {
        return { success: false, message: 'Skipped — not all conditions satisfied' }
      }
    }

    return this._actionRuntime.execute(node.definitionId, ctx, { ...node.params })
  }

  // ── Private: topological sort (Kahn's algorithm) ──

  private _topologicalSort(graph: StrategyGraph): StrategyNode[] {
    const nodeMap = new Map<string, StrategyNode>()
    for (const node of graph.nodes) {
      nodeMap.set(node.id, node)
    }

    const inDegree = new Map<string, number>()
    const adj = buildAdjacencyList(graph.nodes, graph.edges)

    // Only executable nodes participate
    const executableIds = new Set(
      graph.nodes.filter(n => isExecutableNode(n)).map(n => n.id),
    )

    // Initialize in-degree for executable nodes
    for (const id of executableIds) {
      inDegree.set(id, 0)
    }

    // Count incoming edges from executable nodes
    for (const edge of graph.edges) {
      if (executableIds.has(edge.sourceId) && executableIds.has(edge.targetId)) {
        inDegree.set(edge.targetId, (inDegree.get(edge.targetId) ?? 0) + 1)
      }
    }

    // Start with nodes that have no dependencies
    const queue: string[] = []
    for (const id of executableIds) {
      if ((inDegree.get(id) ?? 0) === 0) {
        queue.push(id)
      }
    }

    const sorted: StrategyNode[] = []

    while (queue.length > 0) {
      const u = queue.shift()!
      const node = nodeMap.get(u)
      if (node) sorted.push(node)

      for (const v of adj.get(u) ?? []) {
        if (!executableIds.has(v)) continue
        const newDegree = (inDegree.get(v) ?? 1) - 1
        inDegree.set(v, newDegree)
        if (newDegree === 0) {
          queue.push(v)
        }
      }
    }

    return sorted
  }
}
