// ── ConditionRuntime — evaluates the condition tree ──
//
// Responsible for:
//   1. Recursively evaluating the condition tree
//   2. Tracking per-node state for temporal conditions (Sequence, Cooldown)
//   3. Invalidating state on new bar
//
// The condition tree is set by the strategy:
//
//   runtime.setTree({
//     conditionId: 'and',
//     params: {},
//     children: [
//       { conditionId: 'cross-above', params: { ... }, children: [], signalIds: ['cross-above'] },
//       { conditionId: 'volume-spike', params: { ... }, children: [], signalIds: ['volume-spike'] },
//       { conditionId: 'cooldown', params: { bars: 5 }, children: [] },
//     ],
//   })
//
// @since 3.4.4

import { ConditionRegistry } from '../registry/ConditionRegistry'
import type { ConditionNode, ConditionResult, ConditionInput } from '../types'
import type { ExecutionContext } from '../../context'
import type { SignalResult } from '../../signals'

interface NodeStateEntry {
  state: Record<string, unknown>
}

export class ConditionRuntime {
  private _root: ConditionNode | null = null
  private _nodeStates = new Map<string, NodeStateEntry>()

  /** Set the root condition tree */
  setTree(root: ConditionNode): void {
    this._root = root
    this._nodeStates.clear()
  }

  /** Get the current root tree */
  get root(): ConditionNode | null {
    return this._root
  }

  /**
   * Evaluate the entire condition tree.
   * Returns the root condition's result.
   */
  async evaluate(
    ctx: ExecutionContext,
    signalResults: Map<string, SignalResult>,
  ): Promise<ConditionResult> {
    if (!this._root) {
      return { satisfied: false, reason: 'No condition tree set' }
    }
    return this._evaluateNode(this._root, ctx, signalResults)
  }

  /** Invalidate node states — call on each new bar */
  invalidate(_timestamp: number): void {
    // Temporal conditions manage their own state via nodeState
    // We don't clear here — Sequence and Cooldown need to persist across bars
  }

  /** Reset all node states */
  reset(): void {
    this._nodeStates.clear()
  }

  // ── Private ──

  private _nodeKey(node: ConditionNode): string {
    return `${node.conditionId}:${JSON.stringify(node.children.map(c => c.conditionId))}`
  }

  private async _evaluateNode(
    node: ConditionNode,
    ctx: ExecutionContext,
    signalResults: Map<string, SignalResult>,
  ): Promise<ConditionResult> {
    const def = ConditionRegistry.getInstance().get(node.conditionId)
    if (!def) {
      return { satisfied: false, reason: `Condition not registered: ${node.conditionId}` }
    }

    // Recursively evaluate children
    const childResults: ConditionResult[] = []
    for (const child of node.children) {
      const result = await this._evaluateNode(child, ctx, signalResults)
      childResults.push(result)
    }

    // Get persisted state for this node
    const key = this._nodeKey(node)
    const entry = this._nodeStates.get(key)
    const nodeState = entry?.state ?? {}

    // Evaluate the condition
    const input: ConditionInput = { ctx, signalResults, childResults, nodeState, params: node.params }
    const output = await def.evaluate(input)

    // Persist updated state
    this._nodeStates.set(key, { state: output.nextState })

    return output.result
  }
}
