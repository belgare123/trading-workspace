import { useEffect, useRef } from 'react'
import { useCommands } from '../commands/CommandProvider'
import type { Command } from '../commands/types'

// ── Category colors ────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  Navigation: 'var(--c-info)',
  Inspector: 'var(--c-success)',
  Replay: 'var(--c-warning)',
  View: 'var(--c-info)',
  System: 'var(--c-danger)',
}

function catColor(cat?: string): string {
  return cat ? CAT_COLORS[cat] ?? '#5b6a7a' : '#5b6a7a'
}

// ── Command Row ────────────────────────────────────────────────────

function CommandRow({
  command,
  isSelected,
  onSelect,
}: {
  command: Command
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <div
      onClick={onSelect}
      role="option"
      aria-selected={isSelected}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        cursor: 'pointer',
        background: isSelected ? '#25262b' : 'transparent',
        borderLeft: `3px solid ${isSelected ? catColor(command.category) : 'transparent'}`,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = '#1a1b1e'
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Icon or category dot */}
      {command.icon ?? (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: catColor(command.category),
            flexShrink: 0,
          }}
        />
      )}

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#e4e8ee', fontWeight: 500 }}>{command.title}</div>
        {command.subtitle && (
          <div style={{ fontSize: 11, color: '#5b6a7a', marginTop: 1 }}>{command.subtitle}</div>
        )}
      </div>

      {/* Category + shortcut */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {command.category && (
          <span
            style={{
              fontSize: 10,
              color: catColor(command.category),
              background: catColor(command.category) + '18',
              padding: '1px 5px',
              borderRadius: 3,
            }}
          >
            {command.category}
          </span>
        )}
        {command.shortcut && (
          <kbd
            style={{
              fontSize: 10,
              color: '#5b6a7a',
              background: '#1a1b1e',
              border: '1px solid #2c2e33',
              borderRadius: 3,
              padding: '1px 5px',
              fontFamily: 'inherit',
            }}
          >
            {command.shortcut}
          </kbd>
        )}
      </div>
    </div>
  )
}

// ── Command Palette ────────────────────────────────────────────────

export function CommandPalette() {
  const { paletteOpen, query, setQuery, results, execute, closePalette, history } = useCommands()
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedIndexRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus input on open
  useEffect(() => {
    if (paletteOpen) {
      selectedIndexRef.current = 0
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [paletteOpen])

  if (!paletteOpen) return null

  // Determine which items to show
  const items = query.trim()
    ? results
    : results.slice(0, 6) // Show first few commands when empty (top picks)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        selectedIndexRef.current = Math.min(selectedIndexRef.current + 1, items.length - 1)
        scrollToSelected()
        break
      case 'ArrowUp':
        e.preventDefault()
        selectedIndexRef.current = Math.max(selectedIndexRef.current - 1, 0)
        scrollToSelected()
        break
      case 'Enter': {
        const cmd = items[selectedIndexRef.current]
        if (cmd) execute(cmd.id)
        break
      }
      case 'Escape':
        closePalette()
        break
    }
  }

  const scrollToSelected = () => {
    const list = listRef.current
    if (!list) return
    const selected = list.children[selectedIndexRef.current] as HTMLElement
    selected?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 800,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: '12vh',
        background: 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={closePalette}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxHeight: '60vh',
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
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #2c2e33' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              selectedIndexRef.current = 0
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="command-list"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#e4e8ee',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Result list */}
        <div
          ref={listRef}
          id="command-list"
          role="listbox"
          aria-label="Command results"
          style={{
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {items.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#5b6a7a', fontSize: 12 }}>
              No commands match "{query}"
            </div>
          ) : (
            items.map((cmd, i) => (
              <CommandRow
                key={cmd.id}
                command={cmd}
                isSelected={i === selectedIndexRef.current}
                onSelect={() => execute(cmd.id)}
              />
            ))
          )}
        </div>

        {/* Footer — recent commands */}
        {!query.trim() && history.length > 0 && (
          <>
            <div
              style={{
                padding: '4px 14px',
                fontSize: 10,
                color: '#5b6a7a',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderTop: '1px solid #2c2e33',
              }}
            >
              Recent
            </div>
            <div style={{ maxHeight: 80, overflowY: 'auto' }}>
              {history.slice(0, 5).map((entry) => (
                <div
                  key={entry.commandId + entry.timestamp}
                  onClick={() => execute(entry.commandId)}
                  style={{
                    padding: '4px 14px',
                    fontSize: 12,
                    color: '#8892a4',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1b1e')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {entry.title}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
