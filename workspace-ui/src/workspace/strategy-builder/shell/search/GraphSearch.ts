// ── GraphSearch — Search API ──
//
// Provides a unified search interface over the graph.
// Uses SearchIndex and can be extended with fuzzy matching later.
//
// @since 3.6.4

import type { StrategyGraph } from '../../../strategy/composition/types'
import type { BuilderEventBus } from '../../runtime/BuilderEventBus'
import { SearchIndex } from './SearchIndex'
import type { SearchResult } from '../types'

export class GraphSearch {
  private _index: SearchIndex
  private _eventBus: BuilderEventBus | null = null
  private _graph: StrategyGraph | null = null

  constructor(index?: SearchIndex) {
    this._index = index ?? new SearchIndex()
  }

  connect(eventBus: BuilderEventBus): void {
    this._eventBus = eventBus
  }

  /** Load or reload a graph into the search index */
  loadGraph(graph: StrategyGraph): void {
    this._graph = graph
    this._index.index(graph)
  }

  /** Search the graph — returns SearchResult[] */
  search(query: string): SearchResult[] {
    if (!this._graph || !query.trim()) return []

    // Rebuild index if stale
    if (!this._index.isCurrent(this._graph.id)) {
      this._index.index(this._graph)
    }

    const matches = this._index.search(query)
    const results: SearchResult[] = matches.map(entry => ({
      id: entry.nodeId,
      label: entry.label,
      type: entry.type,
      matchField: 'label',
      matchText: entry.label,
      score: 1,
    }))

    // Emit search changed
    this._eventBus?.emit('builder:search:changed', {
      query,
      results,
    })

    return results
  }

  /** Autocomplete suggestions */
  autocomplete(query: string): Array<{ nodeId: string; label: string; matchField: string }> {
    if (!this._graph || !query.trim()) return []
    return this._index.autocomplete(query)
  }

  /** Mark content as stale */
  markDirty(): void {
    this._index.markDirty()
  }

  /** Clear search */
  clear(): void {
    this._index.clear()
    this._graph = null
  }

  /** Access the raw index */
  get index(): SearchIndex {
    return this._index
  }
}
