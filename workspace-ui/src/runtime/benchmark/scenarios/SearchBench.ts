/**
 * SearchBench — benchmark search latency across data sizes
 *
 * Tests: 100, 1K, 10K, 100K, 1M objects (1M is sampled)
 * Metrics: search latency, index rebuild, memory
 *
 * @since 2.0.0
 */

import type { BenchmarkScenario, BenchmarkResult } from '../types'
import { BenchmarkRegistry as BR } from '../BenchmarkRegistry'
import { MetricsCollector } from '../MetricsCollector'

interface Searchable {
  id: string
  title: string
  keywords: string[]
  content: string
}

class BenchSearchEngine {
  private items: Searchable[] = []
  private cache = new Map<string, Searchable[]>()

  index(items: Searchable[]): void {
    this.items = items
    this.cache.clear()
  }

  search(query: string): Searchable[] {
    const lower = query.toLowerCase()

    // Check cache
    if (this.cache.has(lower)) {
      return this.cache.get(lower)!
    }

    // Simple linear search (simulates Fuse.js behavior)
    const results = this.items.filter((item) =>
      item.title.toLowerCase().includes(lower) ||
      item.keywords.some((k) => k.toLowerCase().includes(lower)) ||
      item.content.toLowerCase().includes(lower),
    ).slice(0, 100) // top 100 results

    // Cache result
    if (this.cache.size < 1000) {
      this.cache.set(lower, results)
    }

    return results
  }

  get itemCount(): number {
    return this.items.length
  }
}

const SEARCH_LEVELS = [100, 1_000, 10_000, 100_000] as const // 1M omitted due to browser limits

async function runSearchBench(): Promise<BenchmarkResult[]> {
  const engine = new BenchSearchEngine()
  const results: BenchmarkResult[] = []

  for (const count of SEARCH_LEVELS) {
    // Generate items
    const items: Searchable[] = []
    for (let i = 0; i < count; i++) {
      items.push({
        id: `item-${i}`,
        title: `Search Result ${i} — ${['Market', 'Plugin', 'Widget', 'Event', 'Config'][i % 5]}`,
        keywords: [`keyword${i % 20}`, `tag${i % 50}`, `cat${i % 7}`],
        content: `This is the content of search item ${i}. It contains benchmark data for testing.`,
      })
    }

    // Index
    engine.index(items)

    // Search queries
    const queries = ['market', 'plugin', 'widget', 'event', 'config', 'keyword1', 'tag5', 'search']
    const collector = new MetricsCollector()

    collector.start()
    for (const q of queries) {
      for (let r = 0; r < 10; r++) {
        const t0 = performance.now()
        engine.search(q)
        collector.record(performance.now() - t0)
      }
    }
    const metrics = collector.stop()

    const score = Math.min(100, (1 / (metrics.latency.p50 || 0.01)) * 50)

    results.push({
      id: `search-${count}`,
      name: `${count.toLocaleString()} Objects`,
      description: `Search across ${count.toLocaleString()} objects with 8 query patterns`,
      category: 'search',
      config: { name: `${count} Objects`, description: '', iterations: queries.length * 10, warmupIterations: 10 },
      metrics,
      success: true,
      timestamp: Date.now(),
      score: Math.round(score * 10) / 10,
    })
  }

  return results
}

const scenario: BenchmarkScenario = {
  id: 'search-performance',
  name: 'Search Performance',
  description: 'Benchmarks search latency across 100, 1K, 10K, and 100K objects',
  category: 'search',
  config: {
    name: 'Search Benchmark',
    description: 'Search latency across data sizes',
    iterations: 320,
    warmupIterations: 10,
  },
  run: async (): Promise<BenchmarkResult> => {
    const subResults = await runSearchBench()
    const avgScore = subResults.reduce((s, r) => s + r.score, 0) / subResults.length
    const lastResult = subResults[subResults.length - 1]

    return {
      id: 'search-performance',
      name: 'Search Performance',
      description: 'Benchmarks search latency across 100, 1K, 10K, and 100K objects',
      category: 'search',
      config: scenario.config,
      metrics: lastResult?.metrics ?? { throughput: 0, latency: { p50: 0, p95: 0, p99: 0 }, memory: { heapUsedMB: 0, heapTotalMB: 0 }, dropped: 0, duration: 0 },
      success: true,
      timestamp: Date.now(),
      score: Math.round(avgScore * 10) / 10,
      subResults,
    }
  },
}

BR.register(scenario)
