// ── Node System Types ──
//
// Pure UI representation types for the visual strategy builder.
// No domain logic — no StrategyNode references in render state.
//
// @since 3.6.2

import type { NodeType } from '../../strategy/composition/types'
import type { StrategyNode } from '../../strategy/composition/types'

// ═══════════════════════════════════════
// Port System
// ═══════════════════════════════════════

export type PortDirection = 'input' | 'output' | 'executionInput' | 'executionOutput'

export interface PortDefinition {
  id: string
  name: string
  direction: PortDirection
  dataType?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

// ═══════════════════════════════════════
// Node Category (wider than domain NodeType)
// ═══════════════════════════════════════

export type NodeCategory = NodeType | 'entry'

// ═══════════════════════════════════════
// View Model — pure UI state
// ═══════════════════════════════════════

export interface NodeViewModel {
  /** Node instance ID (same as StrategyNode.id) */
  id: string
  /** Domain node type */
  type: NodeType
  /** Display label */
  label: string
  /** Position in graph coordinates */
  position: { x: number; y: number }
  /** Size in graph coordinates */
  size: { width: number; height: number }
  /** Collapsed state */
  collapsed: boolean
  /** Render order */
  zIndex: number
  /** Connected ports */
  ports: PortDefinition[]
  /** Category for icon/color selection */
  category: NodeCategory
  /** Whether node is minimised (header only) */
  minimised: boolean
  /** Opacity override (for drag preview, ghost) */
  opacity: number
}

// ═══════════════════════════════════════
// Render Context
// ═══════════════════════════════════════

export interface NodeRenderContext {
  ctx: CanvasRenderingContext2D
  node: NodeViewModel
  selected: boolean
  hovered: boolean
  /** Whether a drag is in progress on this node */
  dragging: boolean
  /** Pixel ratio for sharp rendering */
  dpr: number
}

// ═══════════════════════════════════════
// Hit test result
// ═══════════════════════════════════════

export interface NodeHitTestResult {
  hit: boolean
  part?: 'body' | 'header' | 'port' | 'resize'
  portId?: string
}

// ═══════════════════════════════════════
// Node definitions (the "class" per node type)
// ═══════════════════════════════════════

export interface NodeDefinition {
  /** Unique definition ID (matches StrategyNode.definitionId) */
  id: string
  /** Display category */
  category: NodeCategory
  /** Human-readable type name */
  typeName: string
  /** Default dimensions when created */
  defaultSize: { width: number; height: number }
  /** Build a ViewModel from a domain StrategyNode */
  createView(node: StrategyNode): NodeViewModel
  /** Render the node onto the canvas */
  render(ctx: NodeRenderContext): void
  /** Hit-test a point against this node */
  hitTest(node: NodeViewModel, point: { x: number; y: number }): NodeHitTestResult
  /** Get the port layout for a given StrategyNode */
  getPorts(node: StrategyNode): PortDefinition[]
}
