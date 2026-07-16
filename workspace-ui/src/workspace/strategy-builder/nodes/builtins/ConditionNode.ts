// ── ConditionNode — Visual definition for conditions ──
//
// Bridges ConditionRegistry → visual representation.
//
// @since 3.6.2

import type { StrategyNode } from '../../../strategy/composition/types'
import type { NodeViewModel, PortDefinition } from '../types'
import { NodeDefinition } from '../NodeDefinition'

export class ConditionNode extends NodeDefinition {
  id = '__builtin_condition'
  category = 'condition' as const
  typeName = 'Condition'
  defaultSize = { width: 180, height: 100 }

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
      category: 'condition',
      minimised: false,
      opacity: 1,
    }
  }

  getPorts(_node: StrategyNode): PortDefinition[] {
    return [
      { id: 'exec-in', name: 'Exec', direction: 'executionInput' },
      { id: 'true-out', name: 'True', direction: 'executionOutput', dataType: 'exec' },
      { id: 'false-out', name: 'False', direction: 'executionOutput', dataType: 'exec' },
      { id: 'value-in', name: 'Value', direction: 'input', dataType: 'number' },
      { id: 'threshold-in', name: 'Threshold', direction: 'input', dataType: 'number' },
    ]
  }
}
