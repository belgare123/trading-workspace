import type { SearchResult } from './types'

/**
 * In-memory index for a single search domain.
 * Items are stored and searched by title, keywords, and description.
 */
export class SearchIndex {
  private items: SearchResult[] = []

  /** Replace the entire index with new items */
  rebuild(items: SearchResult[]): void {
    this.items = items
  }

  /** Add or update a single item */
  upsert(item: SearchResult): void {
    const idx = this.items.findIndex(
      (i) => i.id === item.id && i.domain === item.domain,
    )
    if (idx >= 0) {
      this.items[idx] = item
    } else {
      this.items.push(item)
    }
  }

  /** Remove an item by id */
  remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id)
  }

  /** Search the index */
  search(query: string): SearchResult[] {
    const q = query.toLowerCase()
    return this.items.filter((item) => {
      if (item.title.toLowerCase().includes(q)) return true
      if (item.description?.toLowerCase().includes(q)) return true
      return false
    })
  }

  /** Get all items */
  getAll(): SearchResult[] {
    return [...this.items]
  }

  /** Number of items */
  get size(): number {
    return this.items.length
  }
}
