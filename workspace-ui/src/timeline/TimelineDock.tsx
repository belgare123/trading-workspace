import { useRef, useEffect } from 'react'
import { useTimelineStore } from './TimelineStore'
import { useTimelineFeed } from './useTimelineFeed'
import type { TimelineEvent } from './types'

// ── Severity styles ───────────────────────────────────────────────

const SEV_COLORS: Record<string, { dot: string; bg: string }> = {
  info:    { dot: 'var(--c-info)',     bg: 'var(--c-info-bg)' },
  success: { dot: 'var(--c-success)',   bg: 'var(--c-success-bg)' },
  warning: { dot: 'var(--c-warning)',   bg: 'var(--c-warning-bg)' },
  error:   { dot: 'var(--c-danger)',    bg: 'var(--c-danger-bg)' },
}

// ── Event Row ─────────────────────────────────────────────────────

function EventRow({
  event,
  isSelected,
  onSelect,
}: {
  event: TimelineEvent
  isSelected: boolean
  onSelect: (e: TimelineEvent) => void
}) {
  const colors = SEV_COLORS[event.severity] ?? SEV_COLORS.info

  return (
    <div
      onClick={() => onSelect(event)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '3px 10px',
        cursor: 'pointer',
        fontSize: 12,
        color: isSelected ? '#e4e8ee' : '#8892a4',
        background: isSelected ? '#25262b' : 'transparent',
        borderLeft: `3px solid transparent`,
        borderLeftColor: isSelected ? colors.dot : 'transparent',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = '#1a1b1e'
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Dot */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: colors.dot,
          flexShrink: 0,
        }}
      />
      {/* Channel badge */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: '#5b6a7a',
          textTransform: 'uppercase',
          width: 48,
          flexShrink: 0,
        }}
      >
        {event.channel}
      </span>
      {/* Time */}
      <span style={{ fontSize: 10, color: '#5b6a7a', width: 50, flexShrink: 0 }}>
        {formatTime(event.timestamp)}
      </span>
      {/* Title */}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1,
          minWidth: 0,
          color: isSelected ? '#e4e8ee' : '#a0a8b4',
        }}
      >
        {event.title}
      </span>
      {/* Brief description */}
      {event.description && (
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 300,
            color: '#5b6a7a',
            fontSize: 11,
          }}
        >
          {event.description}
        </span>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

// ── Dock ──────────────────────────────────────────────────────────

export function TimelineDock({ isOpen }: { isOpen: boolean }) {
  const events = useTimelineStore((s) => s.events)
  const selectedEvent = useTimelineStore((s) => s.selectedEvent)
  const selectEvent = useTimelineStore((s) => s.selectEvent)

  // Start feeding from RealtimeRuntime
  useTimelineFeed()

  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to top on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [events.length])

  if (!isOpen) return null

  return (
    <div
      style={{
        borderTop: '1px solid #2c2e33',
        background: '#181a1e',
        height: 140,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          borderBottom: '1px solid #2c2e33',
          fontSize: 11,
          fontWeight: 600,
          color: '#5b6a7a',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        <span>Timeline {events.length > 0 && `(${events.length})`}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ cursor: 'pointer' }} title="Scroll to bottom" onClick={() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }}>↓</span>
          <span style={{ cursor: 'pointer' }} title="Clear" onClick={() => useTimelineStore.getState().clear()}>✕</span>
        </div>
      </div>

      {/* Event list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {events.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#5b6a7a', fontSize: 12 }}>
            No events yet. Events appear here as they arrive from the platform.
          </div>
        ) : (
          events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              isSelected={selectedEvent?.id === event.id}
              onSelect={selectEvent}
            />
          ))
        )}
      </div>
    </div>
  )
}
