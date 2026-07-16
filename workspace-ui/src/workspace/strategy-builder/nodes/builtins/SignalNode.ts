// ── SignalNode — Visual definition for signals ──
//
// Bridges SignalRegistry → visual representation.
// No business logic — pure UI definition.
//
// @since 3.6.2

import type { StrategyNode } from '../../../strategy/composition/types'
import type { NodeViewModel, PortDefinition } from '../types'
import { NodeDefinition } from '../NodeDefinition'

export class SignalNode extends NodeDefinition {
  id = '__builtin_signal'
  category = 'signal' as const
  typeName = 'Signal'
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
      category: 'signal',
      minimised: false,
      opacity: 1,
    }
  }

  getPorts(_node: StrategyNode): PortDefinition[] {
    return [
      { id: 'exec-in', name: 'Exec', direction: 'executionInput' },
      { id: 'exec-out', name: 'Exec', direction: 'executionOutput' },
      { id: 'value-out', name: 'Value', direction: 'output', dataType: 'number' },
    ]
  }
}
