// ── EntryNode — Graph execution entry point ──
//
// The starting node of a strategy graph. Always present.
// Routes execution events (onBar, onTick, etc.) into the graph.
//
// @since 3.6.2

import type { StrategyNode } from '../../../strategy/composition/types'
import type { NodeViewModel, PortDefinition } from '../types'
import { NodeDefinition } from '../NodeDefinition'

export class EntryNode extends NodeDefinition {
  id = '__builtin_entry'
  category = 'entry' as const
  typeName = 'Entry'
  defaultSize = { width: 140, height: 50 }

  createView(node: StrategyNode): NodeViewModel {
    return {
      id: node.id,
      type: 'comment', // No dedicated 'entry' NodeType; we reuse comment
      label: node.label || 'START',
      position: node.position ?? { x: 0, y: 0 },
      size: { ...this.defaultSize },
      collapsed: false,
      zIndex: 10, // Always on top
      ports: this.getPorts(node),
      category: 'entry',
      minimised: false,
      opacity: 1,
    }
  }

  getPorts(_node: StrategyNode): PortDefinition[] {
    return [
      { id: 'onbar', name: 'onBar', direction: 'executionOutput', dataType: 'event' },
      { id: 'ontick', name: 'onTick', direction: 'executionOutput', dataType: 'event' },
      { id: 'ontrade', name: 'onTrade', direction: 'executionOutput', dataType: 'event' },
    ]
  }
}
