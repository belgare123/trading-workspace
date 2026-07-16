// ── SearchIndex — Text index for graph nodes ──
//
// Maintains a searchable index over node labels, definitionIds,
// and parameter values. Supports prefix matching.
//
// No fuzzy search yet — the API is designed to add it later.
//
// @since 3.6.4

import type { StrategyGraph } from '../../../strategy/composition/types'

interface IndexEntry {
  nodeId: string
  fields: Record<string, string>
  label: string
  type: string
}

export class SearchIndex {
  private _entries: IndexEntry[] = []
  private _dirty: boolean = true
  private _lastGraphId: string | null = null

  /** Build or rebuild index from graph */
  index(graph: StrategyGraph): void {
    this._entries = graph.nodes.map(node => {
      const fields: Record<string, string> = {
        id: node.id,
        label: node.label.toLowerCase(),
        definitionId: node.definitionId.toLowerCase(),
        type: node.type,
      }

      // Index param values
      for (const [key, val] of Object.entries(node.params)) {
        fields[`param:${key}`] = String(val).toLowerCase()
      }

      return {
        nodeId: node.id,
        fields,
        label: node.label,
        type: node.type,
      }
    })
    this._lastGraphId = graph.id
    this._dirty = false
  }

  /** Mark index as needing rebuild */
  markDirty(): void {
    this._dirty = true
  }

  /** Check if index is current for a graph */
  isCurrent(graphId: string): boolean {
    return !this._dirty && this._lastGraphId === graphId
  }

  /** Search index for all matching entries */
  search(query: string): IndexEntry[] {
    if (!query.trim()) return []

    const q = query.toLowerCase().trim()
    return this._entries.filter(entry => {
      for (const value of Object.values(entry.fields)) {
        if (value.includes(q)) return true
      }
      return false
    })
  }

  /** Quick prefix search (for autocomplete) */
  autocomplete(query: string): Array<{ nodeId: string; label: string; matchField: string }> {
    if (!query.trim()) return []

    const q = query.toLowerCase().trim()
    const results: Array<{ nodeId: string; label: string; matchField: string }> = []

    for (const entry of this._entries) {
      // Label prefix (highest priority)
      if (entry.fields.label.startsWith(q)) {
        results.push({ nodeId: entry.nodeId, label: entry.label, matchField: 'label' })
        continue
      }
      // Definition ID prefix
      if (entry.fields.definitionId.startsWith(q)) {
        results.push({ nodeId: entry.nodeId, label: entry.label, matchField: 'definitionId' })
      }
    }

    return results.slice(0, 10)
  }

  /** Total indexed nodes */
  get size(): number {
    return this._entries.length
  }

  /** Clear index */
  clear(): void {
    this._entries = []
    this._dirty = true
    this._lastGraphId = null
  }
}
