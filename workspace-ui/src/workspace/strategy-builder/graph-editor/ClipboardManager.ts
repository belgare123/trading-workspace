// ── ClipboardManager — Graph copy/paste via GraphSerializer ──
//
// Copies selected nodes+edges as JSON to system clipboard.
// Pastes via deserialize → offset → add to graph.
//
// Uses the existing StrategyGraph infrastructure — no custom serialization.
//
// @since 3.6.3

import type { StrategyGraph, StrategyNode, StrategyEdge } from '../../strategy/composition/types'

let _cid = 0
function uid(): string {
  return `clipboard-${++_cid}`
}

export class ClipboardManager {
  private _serializedGraph: string | null = null

  connect(_nodeRuntime: any): void {
    // Reserved for future integration with NodeRuntime
  }

  /** Copy selected nodes and their connected edges to clipboard */
  copy(ids: string[], edges: StrategyEdge[], layout: StrategyGraph): void {
    if (ids.length === 0) return

    const selectedNodes = layout.nodes.filter(n => ids.includes(n.id))
    const selectedIds = new Set(ids)
    const selectedEdges = edges.filter(e => selectedIds.has(e.sourceId) && selectedIds.has(e.targetId))

    const subgraph: StrategyGraph = {
      id: uid(),
      name: 'clipboard',
      version: layout.version,
      nodes: selectedNodes,
      edges: selectedEdges,
    }

    this._serializedGraph = JSON.stringify(subgraph, null, 2)

    // Try native clipboard API if available
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(this._serializedGraph).catch(() => {
        // Fallback: store in memory
      })
    }
  }

  /** Cut selected nodes (copy + return IDs to remove) */
  cut(ids: string[], edges: StrategyEdge[], layout: StrategyGraph): string[] {
    this.copy(ids, edges, layout)
    return [...ids]
  }

  /** Paste from clipboard — returns nodes+edges to add */
  paste(offset: { x: number; y: number }): { nodes: StrategyNode[]; edges: StrategyEdge[] } | null {
    if (!this._serializedGraph) return null

    try {
      const data = JSON.parse(this._serializedGraph) as StrategyGraph
      if (!data.nodes || !Array.isArray(data.nodes)) return null

      const idMap = new Map<string, string>()

      // Clone nodes with new IDs
      const newNodes: StrategyNode[] = data.nodes.map(n => {
        const newId = uid()
        idMap.set(n.id, newId)
        return {
          ...n,
          id: newId,
          position: {
            x: (n.position?.x ?? 0) + offset.x,
            y: (n.position?.y ?? 0) + offset.y,
          },
          params: { ...n.params },
        }
      })

      // Clone edges with remapped IDs
      const newEdges: StrategyEdge[] = (data.edges || []).map(e => ({
        ...e,
        id: uid(),
        sourceId: idMap.get(e.sourceId) || e.sourceId,
        targetId: idMap.get(e.targetId) || e.targetId,
      }))

      return { nodes: newNodes, edges: newEdges }
    } catch {
      return null
    }
  }

  /** Check if clipboard has data */
  get hasData(): boolean {
    return this._serializedGraph !== null
  }

  /** Clear stored clipboard */
  clear(): void {
    this._serializedGraph = null
  }
}
