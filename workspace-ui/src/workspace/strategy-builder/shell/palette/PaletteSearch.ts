// ── PaletteSearch — Quick-filter by label, category, description ──
//
// Simple prefix/substring filter. Later: fuzzy matching.
//
// @since 3.6.4

import type { PaletteItem, PaletteCategory, SearchResult } from '../types'

export class PaletteSearch {
  /** Filter palette items by query string */
  search(query: string, items: PaletteItem[]): PaletteCategory[] {
    if (!query.trim()) {
      // Return all items grouped by category
      return this._groupByCategory(items)
    }

    const q = query.toLowerCase().trim()
    const filtered = items.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      item.id.toLowerCase().includes(q)
    )

    return this._groupByCategory(filtered)
  }

  /** Score-based search results (for autocomplete) */
  scored(query: string, items: PaletteItem[]): SearchResult[] {
    if (!query.trim()) return []

    const q = query.toLowerCase().trim()
    const results: SearchResult[] = []

    for (const item of items) {
      let bestScore = 0
      let bestField: 'label' | 'definitionId' | 'description' = 'label'
      let bestText = ''

      // Label match (highest priority)
      if (item.label.toLowerCase() === q) {
        bestScore = 100
        bestField = 'label'
        bestText = item.label
      } else if (item.label.toLowerCase().startsWith(q)) {
        bestScore = 80
        bestField = 'label'
        bestText = item.label
      } else if (item.label.toLowerCase().includes(q)) {
        bestScore = 60
        bestField = 'label'
        bestText = item.label
      }

      // ID match
      if (item.id.toLowerCase().includes(q) && bestScore < 50) {
        bestScore = 50
        bestField = 'definitionId'
        bestText = item.id
      }

      // Description match
      if (item.description?.toLowerCase().includes(q) && bestScore < 30) {
        bestScore = 30
        bestField = 'description'
        bestText = item.description
      }

      if (bestScore > 0) {
        results.push({
          id: item.id,
          label: item.label,
          type: item.type,
          matchField: bestField,
          matchText: bestText,
          score: bestScore,
        })
      }
    }

    return results.sort((a, b) => b.score - a.score)
  }

  private _groupByCategory(items: PaletteItem[]): PaletteCategory[] {
    const map = new Map<string, PaletteItem[]>()
    for (const item of items) {
      if (!map.has(item.category)) map.set(item.category, [])
      map.get(item.category)!.push(item)
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }))
  }
}
