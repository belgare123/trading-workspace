import { useTimelineStore } from './TimelineStore'
import type { TimelineEvent } from './types'

const SEV_LABEL: Record<string, { text: string; color: string }> = {
  info:    { text: 'INFO',    color: 'var(--c-info)' },
  success: { text: 'SUCCESS', color: 'var(--c-success)' },
  warning: { text: 'WARNING', color: 'var(--c-warning)' },
  error:   { text: 'ERROR',   color: 'var(--c-danger)' },
}

function EventDetail({ event }: { event: TimelineEvent }) {
  const sev = SEV_LABEL[event.severity] ?? SEV_LABEL.info

  return (
    <div style={{ padding: 14, fontSize: 12, color: '#e4e8ee' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 3,
            background: sev.color + '22',
            color: sev.color,
            border: `1px solid ${sev.color}44`,
          }}
        >
          {sev.text}
        </span>
        <span style={{ fontSize: 10, color: '#5b6a7a', textTransform: 'uppercase' }}>
          {event.channel}
        </span>
        <span style={{ fontSize: 10, color: '#5b6a7a' }}>
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{event.title}</div>

      {/* Description */}
      {event.description && (
        <div style={{ color: '#8892a4', lineHeight: 1.5, marginBottom: 12 }}>
          {event.description}
        </div>
      )}

      {/* Raw data */}
      {event.data != null && (
        <div>
          <div style={{ fontSize: 10, color: '#5b6a7a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Payload
          </div>
          <pre
            style={{
              background: '#1a1b1e',
              border: '1px solid #2c2e33',
              borderRadius: 4,
              padding: 8,
              fontSize: 11,
              color: '#a0a8b4',
              overflow: 'auto',
              maxHeight: 200,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {JSON.stringify(event.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export function Inspector({ isOpen }: { isOpen: boolean }) {
  const selectedEvent = useTimelineStore((s) => s.selectedEvent)
  const selectEvent = useTimelineStore((s) => s.selectEvent)

  if (!isOpen || !selectedEvent) return null

  return (
    <div
      style={{
        width: 360,
        borderLeft: '1px solid #2c2e33',
        background: '#181a1e',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid #2c2e33',
          fontSize: 11,
          fontWeight: 600,
          color: '#5b6a7a',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        <span>Inspector</span>
        <span
          style={{ cursor: 'pointer', fontSize: 14, color: '#5b6a7a' }}
          onClick={() => selectEvent(null)}
          title="Close"
        >
          ✕
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <EventDetail event={selectedEvent} />
      </div>
    </div>
  )
}
