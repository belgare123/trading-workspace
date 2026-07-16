// ── GraphEditorRuntime — Graph editing orchestrator ──
//
// Wires together:
//   BuilderEventBus → ConnectionManager → StrategyGraph → EdgeRenderer
//   NodeRuntime → InteractionManager → GraphCommands
//
// Pure editing orchestration — no business logic, no node execution.
//
// Flow:
//   Pointer → NodeHitTest → ConnectionManager → StrategyGraph.update()
//   → BuilderEventBus → Renderer.invalidate()
//
// @since 3.6.3

import type { StrategyGraph, StrategyNode, StrategyEdge } from '../../strategy/composition/types'
import { BuilderEventBus } from '../runtime/BuilderEventBus'
import { NodeRuntime } from '../nodes/NodeRuntime'
import type { SelectionState } from '../types'
import { ConnectionManager } from './ConnectionManager'
import { EdgeRenderer } from './EdgeRenderer'
import { UndoAdapter } from './UndoAdapter'
import { ClipboardManager } from './ClipboardManager'
import { AutoLayout } from './AutoLayout'
import { buildAllEdgeViews } from './EdgeView'
import type { EdgeViewModel } from './types'

/** Minimal uuid-like generator (no import of full uuid) */
let _cid = 0
function uid(): string {
  return `ge-${++_cid}-${Date.now().toString(36)}`
}

export interface GraphEditorOptions {
  /** Prefix for UndoAdapter entries */
  undoLabelPrefix?: string
  /** Auto-layout options */
  autoLayout?: ConstructorParameters<typeof AutoLayout>[0]
}

export class GraphEditorRuntime {
  private _eventBus: BuilderEventBus
  private _nodeRuntime: NodeRuntime
  private _connectionManager: ConnectionManager
  private _edgeRenderer: EdgeRenderer
  private _undoAdapter: UndoAdapter
  private _clipboardManager: ClipboardManager
  private _autoLayout: AutoLayout

  private _graph: StrategyGraph | null = null
  private _edgeViews: EdgeViewModel[] = []
  private _disposers: (() => void)[] = []

  constructor(
    eventBus: BuilderEventBus,
    nodeRuntime: NodeRuntime,
    edgeRenderer: EdgeRenderer,
    options?: GraphEditorOptions,
  ) {
    this._eventBus = eventBus
    this._nodeRuntime = nodeRuntime
    this._edgeRenderer = edgeRenderer
    this._connectionManager = new ConnectionManager()
    this._undoAdapter = new UndoAdapter()
    this._clipboardManager = new ClipboardManager()
    this._autoLayout = new AutoLayout(options?.autoLayout)

    this._wireListeners()
    this._wireConnectionManager()
  }

  // ── Graph lifecycle ──

  /** Load a new graph — builds edge views and resets undo */
  loadGraph(graph: StrategyGraph): void {
    this._graph = graph
    this._undoAdapter.clear()
    this._rebuildEdgeViews()
    this._edgeRenderer.setEdges(this._edgeViews)
  }

  /** Get the current graph */
  get graph(): StrategyGraph | null {
    return this._graph
  }

  /** Get current edge views */
  get edgeViews(): EdgeViewModel[] {
    return this._edgeViews
  }

  /** Get underlying managers for direct access */
  get connectionManager(): ConnectionManager {
    return this._connectionManager
  }

  get undoAdapter(): UndoAdapter {
    return this._undoAdapter
  }

  get clipboardManager(): ClipboardManager {
    return this._clipboardManager
  }

  // ── Node mutations ──

  /** Add a node to the graph */
  addNode(node: StrategyNode): void {
    if (!this._graph) return
    const before = this._takeSnapshot()
    this._graph.nodes.push(node)
    this._nodeRuntime.add(node)
    this._rebuildEdgeViews()
    this._undoAdapter.record('Add Node', before, this._takeSnapshot())
    this._emitGraphChanged()
  }

  /** Delete a node and its edges */
  deleteNode(nodeId: string): void {
    if (!this._graph) return
    const before = this._takeSnapshot()
    this._graph.nodes = this._graph.nodes.filter(n => n.id !== nodeId)
    this._graph.edges = this._graph.edges.filter(e => e.sourceId !== nodeId && e.targetId !== nodeId)
    this._nodeRuntime.remove(nodeId)
    this._rebuildEdgeViews()
    this._undoAdapter.record('Delete Node', before, this._takeSnapshot())
    this._emitGraphChanged()
  }

  /** Delete multiple nodes and their edges */
  deleteNodes(nodeIds: string[]): void {
    if (!this._graph || nodeIds.length === 0) return
    const before = this._takeSnapshot()
    const idSet = new Set(nodeIds)
    this._graph.nodes = this._graph.nodes.filter(n => !idSet.has(n.id))
    this._graph.edges = this._graph.edges.filter(e => !idSet.has(e.sourceId) && !idSet.has(e.targetId))
    for (const id of nodeIds) this._nodeRuntime.remove(id)
    this._rebuildEdgeViews()
    this._undoAdapter.record(`Delete ${nodeIds.length} Nodes`, before, this._takeSnapshot())
    this._emitGraphChanged()
  }

  // ── Edge mutations ──

  /** Add an edge to the graph */
  addEdge(sourceId: string, targetId: string, label?: string): StrategyEdge | null {
    if (!this._graph) return null
    const before = this._takeSnapshot()
    const edge: StrategyEdge = {
      id: uid(),
      sourceId,
      targetId,
      label,
    }
    this._graph.edges.push(edge)
    this._rebuildEdgeViews()
    this._undoAdapter.record('Connect Nodes', before, this._takeSnapshot())
    this._emitGraphChanged()
    return edge
  }

  /** Delete an edge */
  deleteEdge(edgeId: string): void {
    if (!this._graph) return
    const before = this._takeSnapshot()
    this._graph.edges = this._graph.edges.filter(e => e.id !== edgeId)
    this._rebuildEdgeViews()
    this._undoAdapter.record('Delete Edge', before, this._takeSnapshot())
    this._emitGraphChanged()
  }

  // ── Layout ──

  /** Auto-layout all nodes */
  autoLayout(): void {
    if (!this._graph) return
    const before = this._takeSnapshot()
    this._autoLayout.layout(this._graph.nodes, this._graph.edges)
    // Sync positions to NodeRuntime
    for (const node of this._graph.nodes) {
      if (node.position) {
        this._nodeRuntime.move(node.id, node.position.x, node.position.y)
      }
    }
    this._rebuildEdgeViews()
    this._undoAdapter.record('Auto Layout', before, this._takeSnapshot())
    this._emitGraphChanged()
  }

  // ── Undo / Redo ──

  undo(): void {
    if (!this._graph) return
    const entry = this._undoAdapter.undo()
    if (!entry) return
    this._applySnapshot(entry.snapshot)
    this._eventBus.emit('builder:graph:changed', undefined)
  }

  redo(): void {
    if (!this._graph) return
    const entry = this._undoAdapter.redo()
    if (!entry) return
    this._applySnapshot(entry.snapshot)
    this._eventBus.emit('builder:graph:changed', undefined)
  }

  canUndo(): boolean {
    return this._undoAdapter.canUndo
  }

  canRedo(): boolean {
    return this._undoAdapter.canRedo
  }

  // ── Clipboard ──

  copySelected(): void {
    if (!this._graph) return
    const selected = this._getSelectedIds()
    if (selected.length === 0) return
    this._clipboardManager.copy(selected, this._graph.edges, this._graph)
  }

  cutSelected(): void {
    if (!this._graph) return
    const selected = this._getSelectedIds()
    if (selected.length === 0) return
    this._clipboardManager.copy(selected, this._graph.edges, this._graph)
    this.deleteNodes(selected)
  }

  paste(): void {
    if (!this._graph) return
    const offset = { x: 50, y: 50 }
    const result = this._clipboardManager.paste(offset)
    if (!result) return
    for (const node of result.nodes) {
      this._nodeRuntime.add(node)
      this._graph.nodes.push(node)
    }
    for (const edge of result.edges) {
      this._graph.edges.push(edge)
    }
    this._rebuildEdgeViews()
    this._undoAdapter.record('Paste', this._undoAdapter.undoLabel ?? '', this._takeSnapshot())
    this._emitGraphChanged()
  }

  // ── Select / Deselect ──

  selectAll(): void {
    this._nodeRuntime.selectAll()
  }

  deselectAll(): void {
    this._nodeRuntime.deselectAll()
  }

  canDeselect(): boolean {
    return this._getSelectedIds().length > 0
  }

  // ── Delete / Duplicate ──

  deleteSelected(): void {
    const selected = this._getSelectedIds()
    if (selected.length > 0) this.deleteNodes(selected)
  }

  duplicateSelected(): void {
    if (!this._graph) return
    const selected = this._getSelectedIds()
    if (selected.length === 0) return
    this.copySelected()
    // Clear selection on originals and paste new
    this._nodeRuntime.deselectAll()
    this.paste()
  }

  canDelete(): boolean {
    return this._getSelectedIds().length > 0
  }

  canCopy(): boolean {
    return this._getSelectedIds().length > 0
  }

  canPaste(): boolean {
    return this._clipboardManager.hasData
  }

  // ── Cleanup ──

  destroy(): void {
    for (const fn of this._disposers) fn()
    this._disposers = []
    this._graph = null
    this._edgeViews = []
  }

  // ── Private ──

  private _wireListeners(): void {
    // Rebuild edges when nodes change (moved, added, removed)
    const nodesChangedOff = this._eventBus.on('builder:nodes:changed', () => {
      this._rebuildEdgeViews()
    })

    // Track selection for commands
    const selectionOff = this._eventBus.on('builder:selection:changed', (_state: SelectionState) => {
      // Selection change invalidates command canExecute() states
    })

    this._disposers.push(nodesChangedOff, selectionOff)
  }

  private _wireConnectionManager(): void {
    this._connectionManager.connect(
      this._eventBus,
      this._nodeRuntime,
      (candidate) => {
        this.addEdge(candidate.sourceNodeId, candidate.targetNodeId)
      },
    )

    // Update temporary edge on connection drag
    const connectionOff = this._eventBus.on(
      'builder:connection:changed' as any,
      (state: any) => {
        if (state.phase === 'idle') {
          this._edgeRenderer.setTempEdge(null)
        } else {
          const sourceInst = this._nodeRuntime.get(state.sourceId)
          if (sourceInst) {
            const sourcePos = {
              x: sourceInst.viewModel.position.x + sourceInst.viewModel.size.width,
              y: sourceInst.viewModel.position.y + sourceInst.viewModel.size.height / 2,
            }
            const tempEdge: EdgeViewModel = {
              id: 'temp',
              sourceId: state.sourceId,
              sourcePortId: state.sourcePortId,
              targetId: '',
              targetPortId: '',
              style: 'bezier',
              controlPoints: [sourcePos, state.cursorPosition],
              highlighted: false,
              selected: false,
              animated: false,
            }
            this._edgeRenderer.setTempEdge(tempEdge)
          }
        }
        this._eventBus.emit('builder:rendered', { timestamp: Date.now(), dirtyRects: null, viewport: { originX: 0, originY: 0, zoom: 1, minZoom: 0.1, maxZoom: 5 } })
      },
    )

    this._disposers.push(connectionOff)
  }

  private _rebuildEdgeViews(): void {
    if (!this._graph) {
      this._edgeViews = []
      this._edgeRenderer.setEdges([])
      return
    }

    this._edgeViews = buildAllEdgeViews(
      this._graph.edges,
      (id) => this._nodeRuntime.get(id)?.viewModel,
    )
    this._edgeRenderer.setEdges(this._edgeViews)
  }

  private _getSelectedIds(): string[] {
    return this._nodeRuntime
      .getAll()
      .filter(inst => inst.selected)
      .map(inst => inst.id)
  }

  private _takeSnapshot(): string {
    return this._undoAdapter.snapshot(this._graph!)
  }

  private _applySnapshot(json: string): void {
    const data = JSON.parse(json)
    if (!this._graph) return
    this._graph.nodes = data.nodes
    this._graph.edges = data.edges
    this._graph.layout = data.layout
    this._graph.metadata = data.metadata

    // Reload into NodeRuntime
    this._nodeRuntime.loadFromGraph(this._graph)
    this._rebuildEdgeViews()
  }

  private _emitGraphChanged(): void {
    this._eventBus.emit('builder:graph:changed', undefined)
  }
}
