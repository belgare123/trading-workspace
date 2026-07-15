import Fuse from 'fuse.js'
import { Registry } from '../runtime/Registry'
import type { SearchProvider, SearchResult } from './types'

type SearchListener = (results: SearchResult[], query: string) => void

export class SearchRegistry extends Registry<SearchProvider> {
  private listeners = new Set<SearchListener>()

  register(provider: SearchProvider): void {
    super.register(provider)
    // Trigger reindex if available
    provider.reindex?.()
  }

  getProvider(id: string): SearchProvider | undefined {
    return this.get(id)
  }

  getAllProviders(): SearchProvider[] {
    return this.getAll()
  }

  // ── Search ───────────────────────────────────────────────────────

  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return []

    const trimmed = query.trim()
    const promises: Promise<SearchResult[]>[] = []

    for (const provider of this.items.values()) {
      try {
        const result = provider.search(trimmed)
        if (result instanceof Promise) {
          promises.push(result)
        } else {
          promises.push(Promise.resolve(result))
        }
      } catch (err) {
        console.error(`[SearchRegistry] Error in provider "${provider.id}":`, err)
        promises.push(Promise.resolve([]))
      }
    }

    const results = await Promise.all(promises)

    // Flatten, score, sort
    const flat: SearchResult[] = []
    const providers = Array.from(this.items.values())
    for (let i = 0; i < results.length; i++) {
      const provider = providers[i]
      const priority = provider?.priority ?? 10

      for (const r of results[i]) {
        r.score = this.computeScore(trimmed, r, priority)
        r.domain = provider.id
        flat.push(r)
      }
    }

    flat.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

    // Notify listeners
    this.listeners.forEach((fn) => fn(flat, trimmed))

    return flat
  }

  // ── Subscription ─────────────────────────────────────────────────

  onResults(fn: SearchListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  // ── Score computation ────────────────────────────────────────────

  private computeScore(query: string, result: SearchResult, priority: number): number {
    let score = 0

    const q = query.toLowerCase()
    const title = result.title.toLowerCase()
    const desc = result.description?.toLowerCase() ?? ''

    // Exact title match
    if (title === q) score += 100
    // Title starts with query
    else if (title.startsWith(q)) score += 80
    // Title includes query
    else if (title.includes(q)) score += 50
    // Description includes query
    else if (desc.includes(q)) score += 20

    // Bonus for short queries matching early characters
    if (q.length >= 2) {
      const words = title.split(/\s+/)
      for (const word of words) {
        if (word.startsWith(q)) {
          score += 30
          break
        }
      }
    }

    // Priority bonus (lower number = higher priority)
    score += Math.max(0, 10 - priority) * 5

    // Fuzzy fallback via Fuse
    if (score === 0) {
      const fuse = new Fuse([result], {
        keys: ['title', 'description'],
        threshold: 0.4,
      })
      const fuseResult = fuse.search(q)
      if (fuseResult.length > 0) {
        score = (1 - (fuseResult[0].score ?? 0.5)) * 15
      }
    }

    return score
  }
}

// ── Singleton ──────────────────────────────────────────────────────

export const globalSearchRegistry = new SearchRegistry()
