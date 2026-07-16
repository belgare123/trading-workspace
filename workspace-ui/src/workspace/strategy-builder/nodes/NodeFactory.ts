// ── NodeFactory — StrategyNode → NodeInstance ──
//
// Public API for creating visual node instances from domain nodes.
// The builder never instantiates nodes directly.
//
// @since 3.6.2

import type { StrategyNode } from '../../strategy/composition/types'
import { NodeRegistry } from './NodeRegistry'
import { NodeInstance } from './NodeInstance'

export class NodeFactory {
  private _registry: NodeRegistry

  constructor(registry?: NodeRegistry) {
    this._registry = registry ?? NodeRegistry.getInstance()
  }

  /** Create a NodeInstance from a domain StrategyNode */
  create(node: StrategyNode): NodeInstance {
    const def = this._registry.get(node.definitionId)
    if (!def) {
      throw new Error(`No visual definition registered for node definition '${node.definitionId}' (node '${node.id}')`)
    }
    return new NodeInstance(node, def)
  }

  /** Batch-create instances from a graph's node list */
  createAll(nodes: StrategyNode[]): NodeInstance[] {
    return nodes.map(n => this.create(n))
  }

  /** Check if a definition exists for a given definitionId */
  canCreate(definitionId: string): boolean {
    return this._registry.has(definitionId)
  }
}
