// ── GroupNode — Visual grouping container ──
//
// Renders a semi-transparent rect around child nodes.
// No domain equivalent — visual-only grouping.
//
// @since 3.6.2

import type { StrategyNode } from '../../../strategy/composition/types'
import type { NodeViewModel, PortDefinition } from '../types'
import { NodeDefinition } from '../NodeDefinition'

export class GroupNode extends NodeDefinition {
  id = '__builtin_group'
  category = 'group' as const
  typeName = 'Group'
  defaultSize = { width: 400, height: 300 }

  createView(node: StrategyNode): NodeViewModel {
    return {
      id: node.id,
      type: 'group',
      label: node.label || 'Group',
      position: node.position ?? { x: 0, y: 0 },
      size: { ...this.defaultSize },
      collapsed: false,
      zIndex: -1, // Groups render behind children
      ports: this.getPorts(node),
      category: 'group',
      minimised: false,
      opacity: 1,
    }
  }

  getPorts(_node: StrategyNode): PortDefinition[] {
    return [] // Groups have no ports
  }
}
