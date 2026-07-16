// ── ActionNode — Visual definition for actions ──
//
// Bridges ActionRegistry → visual representation.
//
// @since 3.6.2

import type { StrategyNode } from '../../../strategy/composition/types'
import type { NodeViewModel, PortDefinition } from '../types'
import { NodeDefinition } from '../NodeDefinition'

export class ActionNode extends NodeDefinition {
  id = '__builtin_action'
  category = 'action' as const
  typeName = 'Action'
  defaultSize = { width: 180, height: 80 }

  createView(node: StrategyNode): NodeViewModel {
    return {
      id: node.id,
      type: node.type,
      label: node.label,
      position: node.position ?? { x: 0, y: 0 },
      size: { ...this.defaultSize },
      collapsed: false,
      zIndex: 0,
      ports: this.getPorts(node),
      category: 'action',
      minimised: false,
      opacity: 1,
    }
  }

  getPorts(_node: StrategyNode): PortDefinition[] {
    return [
      { id: 'exec-in', name: 'Exec', direction: 'executionInput' },
      { id: 'signal-in', name: 'Signal', direction: 'input', dataType: 'number' },
    ]
  }
}
