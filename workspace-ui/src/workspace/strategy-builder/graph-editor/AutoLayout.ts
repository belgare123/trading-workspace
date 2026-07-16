// ── AutoLayout — DAG layout algorithm ──
//
// Pure layout computation — no side effects.
// Pluggable: can be replaced with ELK / Dagre later.
//
// Algorithm:
//   1. Layer assignment (topological sort, longest path)
//   2. Node ordering within layers (reduce crossings — heuristic)
//   3. Coordinate assignment (horizontal spread, vertical centering)
//
// @since 3.6.3

import type { StrategyNode, StrategyEdge } from '../../strategy/composition/types'

export interface AutoLayoutOptions {
  /** Horizontal spacing between layers */
  layerSpacing: number
  /** Vertical spacing between nodes in same layer */
  nodeSpacing: number
  /** Top-left margin */
  margin: number
}

const DEFAULT_OPTIONS: AutoLayoutOptions = {
  layerSpacing: 250,
  nodeSpacing: 40,
  margin: 40,
}

export class AutoLayout {
  private _options: AutoLayoutOptions

  constructor(options?: Partial<AutoLayoutOptions>) {
    this._options = { ...DEFAULT_OPTIONS, ...options }
  }

  /** Compute layout positions — mutates StrategyNode positions */
  layout(nodes: StrategyNode[], edges: StrategyEdge[]): void {
    const { layerSpacing, nodeSpacing, margin } = this._options

    // ── 1. Build adjacency and in-degree ──
    const adj = new Map<string, string[]>()
    const inDeg = new Map<string, number>()
    for (const n of nodes) {
      adj.set(n.id, [])
      inDeg.set(n.id, 0)
    }
    for (const e of edges) {
      adj.get(e.sourceId)?.push(e.targetId)
      inDeg.set(e.targetId, (inDeg.get(e.targetId) || 0) + 1)
    }

    // ── 2. Layer assignment (topological order → layers) ──
    // Longest-path layering: find layers on the critical path
    const layers: string[][] = []
    const nodeLayer = new Map<string, number>()

    // Start with nodes that have no predecessors — they're layer 0
    let queue: string[] = []
    for (const n of nodes) {
      const preds = edges.filter(e => e.targetId === n.id)
      if (preds.length === 0) {
        queue.push(n.id)
        nodeLayer.set(n.id, 0)
      }
    }

    // BFS-based layering
    const visited = new Set<string>()
    while (queue.length > 0) {
      const next: string[] = []
      for (const id of queue) {
        if (visited.has(id)) continue
        visited.add(id)
        const layer = nodeLayer.get(id) ?? 0
        if (!layers[layer]) layers[layer] = []
        layers[layer].push(id)

        for (const succ of adj.get(id) || []) {
          const currentLayer = nodeLayer.get(succ) ?? 0
          nodeLayer.set(succ, Math.max(currentLayer, layer + 1))
          next.push(succ)
        }
      }
      queue = next
    }

    // Any remaining nodes (isolated) go to layer 0
    for (const n of nodes) {
      if (!nodeLayer.has(n.id)) {
        nodeLayer.set(n.id, 0)
        if (!layers[0]) layers[0] = []
        if (!layers[0].includes(n.id)) layers[0].push(n.id)
      }
    }

    // ── 3. Node ordering (simple: by node count heuristic) ──
    // In future: barycenter heuristic for crossing reduction
    for (const layer of layers) {
      // Sort by number of outgoing connections (more connected → center)
      layer.sort((a, b) => (adj.get(b)?.length ?? 0) - (adj.get(a)?.length ?? 0))
    }

    // ── 4. Coordinate assignment ──
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li]
      const maxLayerNodes = Math.max(...layers.map(l => l.length))
      const layerHeight = layer.length * (80 + nodeSpacing) - nodeSpacing // default node height 80

      const startY = margin + (maxLayerNodes * (80 + nodeSpacing) - layerHeight) / 2

      for (let ni = 0; ni < layer.length; ni++) {
        const nodeId = layer[ni]
        const node = nodes.find(n => n.id === nodeId)
        if (node) {
          // Use existing position if already set (for incremental layout)
          if (!node.position || node.position.x === 0) {
            node.position = {
              x: margin + li * layerSpacing,
              y: startY + ni * (80 + nodeSpacing),
            }
          }
        }
      }
    }
  }

  /** Compute layout and return the resulting StrategyNode[] with updated positions */
  compute(nodes: StrategyNode[], edges: StrategyEdge[]): StrategyNode[] {
    this.layout(nodes, edges)
    return nodes
  }

  /** Get options for modification */
  get options(): AutoLayoutOptions {
    return { ...this._options }
  }

  setOptions(options: Partial<AutoLayoutOptions>): void {
    this._options = { ...this._options, ...options }
  }
}
