// ── MiniMapRuntime — Builds scaled view from NodeRuntime ──
//
// Does NOT create a second graph. Uses the same NodeView + EdgeView,
// applies a scaled transform for the minimap.
//
// @since 3.6.4

import type { NodeRuntime } from '../../nodes/NodeRuntime'

export interface MiniMapState {
  /** Bounding box of all nodes (graph-space) */
  bounds: { x: number; y: number; width: number; height: number } | null
  /** Scale factor (graph→minimap) */
  scale: number
  /** Viewport rectangle (graph-space) — shows the current visible area */
  viewport: { x: number; y: number; width: number; height: number }
  /** Node positions in minimap-space */
  nodes: Array<{
    id: string
    x: number
    y: number
    width: number
    height: number
    selected: boolean
    label: string
  }>
  /** Edge start/end points in minimap-space */
  edges: Array<{
    id: string
    sx: number
    sy: number
    tx: number
    ty: number
  }>
}

export interface MiniMapViewport {
  originX: number
  originY: number
  zoom: number
}

export class MiniMapRuntime {
  private _nodeRuntime: NodeRuntime | null = null

  /** Minimap dimensions (CSS pixels) */
  width: number = 200
  height: number = 150
  padding: number = 8
  nodeMinWidth: number = 20
  nodeMinHeight: number = 12

  connect(nodeRuntime: NodeRuntime): void {
    this._nodeRuntime = nodeRuntime
  }

  /** Compute minimap state from current NodeRuntime + viewport */
  compute(viewport: MiniMapViewport, selectedIds: string[]): MiniMapState {
    const instances = this._nodeRuntime?.getAll() ?? []
    if (instances.length === 0) {
      return {
        bounds: null,
        scale: 1,
        viewport: { x: 0, y: 0, width: this.width, height: this.height },
        nodes: [],
        edges: [],
      }
    }

    // Compute graph-space bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const inst of instances) {
      const v = inst.viewModel
      minX = Math.min(minX, v.position.x)
      minY = Math.min(minY, v.position.y)
      maxX = Math.max(maxX, v.position.x + v.size.width)
      maxY = Math.max(maxY, v.position.y + v.size.height)
    }

    const graphWidth = maxX - minX || 1
    const graphHeight = maxY - minY || 1
    const availWidth = this.width - this.padding * 2
    const availHeight = this.height - this.padding * 2
    const scale = Math.min(availWidth / graphWidth, availHeight / graphHeight, 1)
    const offsetX = this.padding - minX * scale
    const offsetY = this.padding - minY * scale

    // Nodes in minimap-space
    const nodes = instances.map(inst => {
      const v = inst.viewModel
      return {
        id: inst.id,
        x: v.position.x * scale + offsetX,
        y: v.position.y * scale + offsetY,
        width: Math.max(v.size.width * scale, this.nodeMinWidth),
        height: Math.max(v.size.height * scale, this.nodeMinHeight),
        selected: selectedIds.includes(inst.id),
        label: inst.strategyNode?.label ?? v.label ?? '',
      }
    })

    // Viewport rectangle in graph-space
    const vp: MiniMapState['viewport'] = {
      x: -viewport.originX / viewport.zoom,
      y: -viewport.originY / viewport.zoom,
      width: this.width / viewport.zoom,
      height: this.height / viewport.zoom,
    }

    // Edges (we need edge data from somewhere — this is simplified)
    const edges: MiniMapState['edges'] = []

    return {
      bounds: { x: minX, y: minY, width: graphWidth, height: graphHeight },
      scale,
      viewport: vp,
      nodes,
      edges,
    }
  }

  /** Convert minimap pixel → graph coordinate */
  pixelToGraph(pixelX: number, pixelY: number, state: MiniMapState): { x: number; y: number } | null {
    if (!state.bounds) return null
    const gx = (pixelX - this.padding) / state.scale + state.bounds.x
    const gy = (pixelY - this.padding) / state.scale + state.bounds.y
    return { x: gx, y: gy }
  }
}
