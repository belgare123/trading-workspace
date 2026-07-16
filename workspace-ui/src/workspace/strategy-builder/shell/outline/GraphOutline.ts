// ── GraphOutline — Tree/outline view of graph structure ──
//
// Builds a hierarchical tree from the graph's flat node list.
// Supports: nesting by groups, sort by type, search filter.
//
// @since 3.6.4

import type { StrategyGraph, StrategyNode } from '../../../strategy/composition/types'
import type { OutlineEntry } from '../types'

export interface GraphOutlineOptions {
  /** Include group children */
  expandGroups: boolean
  /** Sort entries */
  sortBy: 'type' | 'label' | 'position'
  /** Filter query */
  filter?: string
}

const DEFAULT_OPTIONS: GraphOutlineOptions = {
  expandGroups: true,
  sortBy: 'type',
}

export class GraphOutline {
  private _options: GraphOutlineOptions

  constructor(options?: Partial<GraphOutlineOptions>) {
    this._options = { ...DEFAULT_OPTIONS, ...options }
  }

  /** Build outline tree from a graph */
  build(graph: StrategyGraph): OutlineEntry[] {
    const nodes = graph.nodes
    const groupNodes = nodes.filter(n => n.type === 'group')
    const groupIds = new Set(groupNodes.map(g => g.id))
    const otherNodes = nodes.filter(n => !groupIds.has(n.id))

    // Build group children
    const entries: OutlineEntry[] = []

    for (const group of groupNodes) {
      const children = otherNodes
        .filter(n => this._isInGroup(n, group.id, nodes))
        .map(n => this._nodeToEntry(n, 1, graph))
      const entry = this._nodeToEntry(group, 0, graph)
      entry.children = this._options.expandGroups ? children : []
      entries.push(entry)
    }

    // Ungrouped nodes
    const usedInGroup = new Set<string>()
    for (const group of groupNodes) {
      for (const n of otherNodes.filter(n => this._isInGroup(n, group.id, nodes))) {
        usedInGroup.add(n.id)
      }
    }
    const ungrouped = otherNodes.filter(n => !usedInGroup.has(n.id))
    for (const n of ungrouped) {
      entries.push(this._nodeToEntry(n, 0, graph))
    }

    // Sort
    this._sort(entries)
    return entries
  }

  /** Update options */
  setOptions(options: Partial<GraphOutlineOptions>): void {
    this._options = { ...this._options, ...options }
  }

  // ── Private ──

  private _nodeToEntry(node: StrategyNode, depth: number, graph: StrategyGraph): OutlineEntry {
    const edgesFrom = graph.edges.filter(e => e.sourceId === node.id)
    const edgesTo = graph.edges.filter(e => e.targetId === node.id)
    return {
      id: node.id,
      label: node.label,
      type: node.type,
      depth,
      expanded: true,
      children: [],
      metadata: {
        inputs: String(edgesTo.length),
        outputs: String(edgesFrom.length),
        ...(node.position ? { x: String(Math.round(node.position.x)), y: String(Math.round(node.position.y)) } : {}),
      },
    }
  }

  private _isInGroup(node: StrategyNode, groupId: string, allNodes: StrategyNode[]): boolean {
    // Simple heuristic: node position is within group bounds
    const group = allNodes.find(n => n.id === groupId)
    if (!group || !group.position || !node.position) return false
    const gx = group.position.x
    const gy = group.position.y
    const gw = 300 // default group width
    const gh = 300 // default group height
    return (
      node.position.x >= gx &&
      node.position.x <= gx + gw &&
      node.position.y >= gy &&
      node.position.y <= gy + gh
    )
  }

  private _sort(entries: OutlineEntry[]): void {
    switch (this._options.sortBy) {
      case 'type':
        entries.sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label))
        break
      case 'label':
        entries.sort((a, b) => a.label.localeCompare(b.label))
        break
      case 'position':
        entries.sort((a, b) => {
          const ay = parseInt(a.metadata?.y ?? '0')
          const by = parseInt(b.metadata?.y ?? '0')
          return ay - by
        })
        break
    }
  }
}
