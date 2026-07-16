// ── NodeInstance — ViewModel + domain reference ──
//
// Wraps a NodeViewModel with a pointer to its StrategyNode.
// This is the runtime unit the builder operates on.
//
// @since 3.6.2

import type { StrategyNode } from '../../strategy/composition/types'
import type { NodeViewModel, PortDefinition, NodeDefinition } from './types'

export class NodeInstance {
  readonly id: string
  readonly strategyNode: StrategyNode
  readonly definition: NodeDefinition

  viewModel: NodeViewModel

  /** Selection state (managed by NodeRuntime) */
  selected: boolean = false
  /** Hover state (managed by InteractionManager) */
  hovered: boolean = false
  /** Drag offset during active drag */
  dragOffset: { x: number; y: number } | null = null

  constructor(strategyNode: StrategyNode, definition: NodeDefinition) {
    this.id = strategyNode.id
    this.strategyNode = strategyNode
    this.definition = definition
    this.viewModel = definition.createView(strategyNode)
  }

  /** Sync ViewModel position back to StrategyNode.position */
  syncPositionToNode(): void {
    this.strategyNode.position = { ...this.viewModel.position }
  }

  /** Update ViewModel from StrategyNode (when domain changes) */
  syncFromNode(): void {
    this.viewModel = this.definition.createView(this.strategyNode)
  }

  /** Get ports from definition */
  get ports(): PortDefinition[] {
    return this.definition.getPorts(this.strategyNode)
  }
}
