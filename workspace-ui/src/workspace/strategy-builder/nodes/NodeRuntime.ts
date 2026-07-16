// ── NodeRuntime — UI-state manager ──
//
// Owns all NodeInstances and manages pure UI state:
//   coordinates, sizes, selection, collapse, hover, z-index, drag.
//
// NO business logic — no evaluate(), execute(), onBar().
//
// @since 3.6.2

import type { BuilderEventBus } from '../runtime/BuilderEventBus'
import type { NodeViewModel, NodeHitTestResult } from './types'
import { NodeInstance } from './NodeInstance'
import { NodeFactory } from './NodeFactory'
import type { StrategyNode, StrategyGraph } from '../../strategy/composition/types'

export class NodeRuntime {
  private _instances: Map<string, NodeInstance> = new Map()
  private _order: string[] = [] // z-order tracking
  private _eventBus: BuilderEventBus | null = null
  private _factory: NodeFactory
  private _nextZ: number = 1

  constructor(factory?: NodeFactory) {
    this._factory = factory ?? new NodeFactory()
  }

  connect(eventBus: BuilderEventBus): void {
    this._eventBus = eventBus
  }

  // ── Lifecycle ──

  /** Load/replace all nodes from a graph */
  loadFromGraph(graph: StrategyGraph): void {
    this._instances.clear()
    this._order = []
    for (const node of graph.nodes) {
      const inst = this._factory.create(node)
      this._instances.set(inst.id, inst)
      this._order.push(inst.id)
    }
    this._emitChanged()
  }

  /** Add a single node (from domain) */
  add(node: StrategyNode): NodeInstance {
    const inst = this._factory.create(node)
    inst.viewModel.zIndex = this._nextZ++
    this._instances.set(inst.id, inst)
    this._order.push(inst.id)
    this._emitChanged('added', [inst.id])
    return inst
  }

  /** Remove a node */
  remove(id: string): void {
    this._instances.delete(id)
    const idx = this._order.indexOf(id)
    if (idx >= 0) this._order.splice(idx, 1)
    this._emitChanged('removed', [id])
  }

  /** Get a node instance */
  get(id: string): NodeInstance | undefined {
    return this._instances.get(id)
  }

  /** Get all instances */
  getAll(): NodeInstance[] {
    return this._order.map(id => this._instances.get(id)!).filter(Boolean)
  }

  /** Count */
  get size(): number {
    return this._instances.size
  }

  // ── UI State mutations (pure UI — no domain changes) ──

  /** Move a node to new graph coordinates */
  move(id: string, x: number, y: number): void {
    const inst = this._instances.get(id)
    if (!inst) return
    inst.viewModel.position = { x, y }
    inst.syncPositionToNode()
    this._emitChanged('updated', [id])
  }

  /** Resize a node */
  resize(id: string, width: number, height: number): void {
    const inst = this._instances.get(id)
    if (!inst) return
    inst.viewModel.size = { width, height }
    this._emitChanged('updated', [id])
  }

  /** Toggle collapsed state (visual only — no domain impact) */
  toggleCollapse(id: string): void {
    const inst = this._instances.get(id)
    if (!inst) return
    inst.viewModel.collapsed = !inst.viewModel.collapsed
    this._emitChanged('updated', [id])
  }

  /** Set selection state */
  select(id: string, selected: boolean = true): void {
    const inst = this._instances.get(id)
    if (!inst) return
    inst.selected = selected
    this._emitChanged('updated', [id])
  }

  /** Select all */
  selectAll(): void {
    for (const inst of this._instances.values()) inst.selected = true
    this._emitChanged()
  }

  /** Deselect all */
  deselectAll(): void {
    for (const inst of this._instances.values()) inst.selected = false
    this._emitChanged()
  }

  /** Bring to front */
  bringToFront(id: string): void {
    const inst = this._instances.get(id)
    if (!inst) return
    inst.viewModel.zIndex = this._nextZ++
    const idx = this._order.indexOf(id)
    if (idx >= 0) {
      this._order.splice(idx, 1)
      this._order.push(id)
    }
    this._emitChanged('updated', [id])
  }

  /** Send to back */
  sendToBack(id: string): void {
    const inst = this._instances.get(id)
    if (!inst) return
    inst.viewModel.zIndex = 0
    const idx = this._order.indexOf(id)
    if (idx >= 0) {
      this._order.splice(idx, 1)
      this._order.unshift(id)
    }
    this._emitChanged('updated', [id])
  }

  /** Set hover state */
  setHover(id: string | null): void {
    for (const inst of this._instances.values()) inst.hovered = inst.id === id
  }

  // ── Hit testing ──

  hitTest(point: { x: number; y: number }): { instance: NodeInstance; result: NodeHitTestResult } | null {
    // Reverse order — topmost first
    const instances = this.getAll().reverse()
    for (const inst of instances) {
      const result = inst.definition.hitTest(inst.viewModel, point)
      if (result.hit) return { instance: inst, result }
    }
    return null
  }

  /** Get view models for rendering (sorted by z-order) */
  getViewModels(): NodeViewModel[] {
    return this._order
      .map(id => this._instances.get(id)?.viewModel)
      .filter((v): v is NodeViewModel => !!v)
  }

  /** Sync all positions back to strategy nodes */
  syncAllPositions(): void {
    for (const inst of this._instances.values()) inst.syncPositionToNode()
  }

  // ── Private ──

  private _emitChanged(type?: 'added' | 'removed' | 'updated', ids?: string[]): void {
    this._eventBus?.emit('builder:nodes:changed', {
      added: type === 'added' ? ids : undefined,
      removed: type === 'removed' ? ids : undefined,
      updated: type === 'updated' ? ids : undefined,
    })
  }
}
