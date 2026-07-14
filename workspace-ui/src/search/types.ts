/** A single search result across any domain. */
export interface SearchResult {
  /** Unique id within its adapter domain */
  id: string
  /** Adapter id, e.g. 'plugins', 'strategies' */
  domain: string
  /** Human-readable title */
  title: string
  /** Optional description / excerpt */
  description?: string
  /** URL / path to navigate to on select */
  url?: string
  /** Optional icon/emoji */
  icon?: string
  /** Arbitrary payload for the target page */
  payload?: Record<string, unknown>
  /** Relevance score (0-1), set by SearchRegistry */
  score?: number
}

/** A search provider adapter registered by a domain module. */
export interface SearchProvider {
  /** Unique provider id, e.g. 'plugins', 'strategies' */
  id: string
  /** Human-readable name */
  name: string
  /** Optional icon/emoji */
  icon?: string
  /** Priority for result ordering (lower = higher) */
  priority?: number
  /** Search function — returns results for a query */
  search: (query: string) => Promise<SearchResult[]> | SearchResult[]
  /** Optional: re-index all data (called on registration) */
  reindex?: () => Promise<void> | void
}

/** Combined search state */
export interface FederatedSearchState {
  query: string
  results: SearchResult[]
  isSearching: boolean
  isOpen: boolean
  activeDomain: string | null
}
