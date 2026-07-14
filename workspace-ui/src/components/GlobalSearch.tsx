import { useEffect, useRef } from 'react'
import { useSearch } from '../search/SearchProvider'
import type { SearchResult } from '../search/types'

// ── Domain colors ──────────────────────────────────────────────────

const DOMAIN_COLORS: Record<string, string> = {
  opportunities: '#22c55e',
  plugins: '#3b82f6',
  strategies: '#a855f7',
  events: '#f59e0b',
  models: '#06b6d4',
  replay: '#ef4444',
}

function domainColor(domain: string): string {
  return DOMAIN_COLORS[domain] ?? '#5b6a7a'
}

// ── Domain filter pills ─────────────────────────────────────────────

const DOMAINS = [
  { id: 'opportunities', label: 'Opportunities', icon: '🎯' },
  { id: 'plugins', label: 'Plugins', icon: '🧩' },
  { id: 'strategies', label: 'Strategies', icon: '🧠' },
  { id: 'events', label: 'Events', icon: '📋' },
  { id: 'models', label: 'Models', icon: '🤖' },
  { id: 'replay', label: 'Replay', icon: '▶️' },
]

// ── Result row ─────────────────────────────────────────────────────

function ResultRow({
  result,
  isSelected,
  onSelect,
}: {
  result: SearchResult
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        cursor: 'pointer',
        background: isSelected ? '#25262b' : 'transparent',
        borderLeft: `3px solid ${isSelected ? domainColor(result.domain) : 'transparent'}`,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = '#1a1b1e'
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: 14, flexShrink: 0 }}>
        {result.icon ?? '📄'}
      </span>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#e4e8ee', fontWeight: 500 }}>
          {result.title}
        </div>
        {result.description && (
          <div
            style={{
              fontSize: 11,
              color: '#5b6a7a',
              marginTop: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {result.description}
          </div>
        )}
      </div>

      {/* Domain badge */}
      <span
        style={{
          fontSize: 10,
          color: domainColor(result.domain),
          background: domainColor(result.domain) + '18',
          padding: '1px 5px',
          borderRadius: 3,
          flexShrink: 0,
        }}
      >
        {result.domain}
      </span>
    </div>
  )
}

// ── GlobalSearch UI ─────────────────────────────────────────────────

export function GlobalSearch() {
  const {
    isOpen,
    query,
    setQuery,
    results,
    isSearching,
    close,
    execute,
    activeDomain,
    setActiveDomain,
  } = useSearch()
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedIndexRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      selectedIndexRef.current = 0
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        selectedIndexRef.current = Math.min(selectedIndexRef.current + 1, results.length - 1)
        scrollToSelected()
        break
      case 'ArrowUp':
        e.preventDefault()
        selectedIndexRef.current = Math.max(selectedIndexRef.current - 1, 0)
        scrollToSelected()
        break
      case 'Enter': {
        const item = results[selectedIndexRef.current]
        if (item) execute(item)
        break
      }
      case 'Escape':
        close()
        break
    }
  }

  const scrollToSelected = () => {
    const list = listRef.current
    if (!list) return
    const selected = list.children[selectedIndexRef.current] as HTMLElement
    selected?.scrollIntoView({ block: 'nearest' })
  }

  const domainResults = activeDomain
    ? results.filter((r) => r.domain === activeDomain)
    : results

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 800,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: '8vh',
        background: 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 600,
          maxHeight: '70vh',
          background: '#1a1b1e',
          border: '1px solid #2c2e33',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid #2c2e33',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#5b6a7a', fontSize: 14 }}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                selectedIndexRef.current = 0
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search everything — strategies, plugins, events, models..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#e4e8ee',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
            {isSearching && (
              <span style={{ color: '#5b6a7a', fontSize: 11 }}>searching...</span>
            )}
          </div>
        </div>

        {/* Domain filter pills */}
        {query.trim() && (
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '6px 14px',
              borderBottom: '1px solid #2c2e33',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => setActiveDomain(null)}
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid #2c2e33',
                background: activeDomain === null ? '#25262b' : 'transparent',
                color: '#e4e8ee',
                cursor: 'pointer',
              }}
            >
              All
            </button>
            {DOMAINS.map((d) => (
              <button
                key={d.id}
                onClick={() =>
                  setActiveDomain(activeDomain === d.id ? null : d.id)
                }
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: `1px solid ${
                    activeDomain === d.id ? domainColor(d.id) : '#2c2e33'
                  }`,
                  background:
                    activeDomain === d.id
                      ? domainColor(d.id) + '18'
                      : 'transparent',
                  color: activeDomain === d.id ? domainColor(d.id) : '#8892a4',
                  cursor: 'pointer',
                }}
              >
                {d.icon} {d.label}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div
          ref={listRef}
          style={{ flex: 1, overflowY: 'auto', minHeight: 100 }}
        >
          {!query.trim() ? (
            <div
              style={{
                padding: 30,
                textAlign: 'center',
                color: '#5b6a7a',
                fontSize: 12,
              }}
            >
              Start typing to search across the entire platform
            </div>
          ) : results.length === 0 && !isSearching ? (
            <div
              style={{
                padding: 30,
                textAlign: 'center',
                color: '#5b6a7a',
                fontSize: 12,
              }}
            >
              No results for "{query}"
            </div>
          ) : (
            domainResults.map((r, i) => (
              <ResultRow
                key={`${r.domain}:${r.id}`}
                result={r}
                isSelected={i === selectedIndexRef.current}
                onSelect={() => execute(r)}
              />
            ))
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '6px 14px',
            borderTop: '1px solid #2c2e33',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: '#5b6a7a',
          }}
        >
          <span>↑↓ navigate · Enter open · Esc close</span>
          <span>
            {results.length > 0
              ? `${results.length} result${results.length !== 1 ? 's' : ''}`
              : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
