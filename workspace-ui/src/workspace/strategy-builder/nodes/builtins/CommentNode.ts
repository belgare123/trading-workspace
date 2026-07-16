// ── CommentNode — Annotation note ──
//
// Visual-only annotation. No domain equivalent.
//
// @since 3.6.2

import type { StrategyNode } from '../../../strategy/composition/types'
import type { NodeViewModel, PortDefinition } from '../types'
import { NodeDefinition } from '../NodeDefinition'

export class CommentNode extends NodeDefinition {
  id = '__builtin_comment'
  category = 'comment' as const
  typeName = 'Comment'
  defaultSize = { width: 200, height: 120 }

  createView(node: StrategyNode): NodeViewModel {
    return {
      id: node.id,
      type: 'comment',
      label: node.label || 'Note',
      position: node.position ?? { x: 0, y: 0 },
      size: { ...this.defaultSize },
      collapsed: false,
      zIndex: -2, // Comments render behind everything
      ports: this.getPorts(node),
      category: 'comment',
      minimised: false,
      opacity: 0.8,
    }
  }

  getPorts(_node: StrategyNode): PortDefinition[] {
    return []
  }
}
