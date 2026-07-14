import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import { globalSearchRegistry, SearchRegistry } from './SearchRegistry'
import type { SearchResult } from './types'
import { useStore } from '../store'
import { Telemetry } from '../telemetry'

// ── Context ─────────────────────────────────────────────────────────

interface SearchContextValue {
  registry: SearchRegistry
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  query: string
  setQuery: (q: string) => void
  results: SearchResult[]
  isSearching: boolean
  execute: (result: SearchResult) => void
  activeDomain: string | null
  setActiveDomain: (d: string | null) => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

// ── Debounce ────────────────────────────────────────────────────────

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

// ── Provider ────────────────────────────────────────────────────────

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeDomain, setActiveDomain] = useState<string | null>(null)

  const debouncedQuery = useDebounce(query, 200)

  // Search on debounced query change
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }

    let cancelled = false
    setIsSearching(true)

    globalSearchRegistry.search(debouncedQuery).then((res) => {
      if (!cancelled) {
        // Filter by active domain if set
        const filtered = activeDomain
          ? res.filter((r) => r.domain === activeDomain)
          : res
        setResults(filtered)
        setIsSearching(false)
        // Telemetry: log search query
        Telemetry.searchQuery(debouncedQuery, activeDomain ?? undefined)
      }
    })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, activeDomain])

  const open = useCallback(() => {
    setIsOpen(true)
    setQuery('')
    setResults([])
    setActiveDomain(null)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setActiveDomain(null)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        setQuery('')
        setResults([])
        setActiveDomain(null)
      }
      return !prev
    })
  }, [])

  const execute = useCallback(
    (result: SearchResult) => {
      // Navigate based on result URL or payload
      if (result.url) {
        // For now, use the active view mapping
        const domainToView: Record<string, string> = {
          opportunities: 'inspector',
          strategies: 'strategies',
          plugins: 'plugins',
          replay: 'replay',
          models: 'learning',
          events: 'system',
        }
        const view = domainToView[result.domain] || 'scanner'
        useStore.getState().setActiveView(view)
      }
      close()
    },
    [close],
  )

  return (
    <SearchContext.Provider
      value={{
        registry: globalSearchRegistry,
        isOpen,
        open,
        close,
        toggle,
        query,
        setQuery,
        results,
        isSearching,
        execute,
        activeDomain,
        setActiveDomain,
      }}
    >
      {children}
    </SearchContext.Provider>
  )
}

// ── Hook ────────────────────────────────────────────────────────────

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useSearch must be used within a SearchProvider')
  return ctx
}
