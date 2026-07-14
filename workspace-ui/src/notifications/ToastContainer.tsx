import { useNotification } from './NotificationProvider'
import type { NotificationType } from './types'

// ── Icons per type ──────────────────────────────────────────────────

const ICONS: Record<NotificationType, string> = {
  success: '✔',
  warning: '⚠',
  error: '✖',
  info: 'ℹ',
}

const BORDER_COLORS: Record<NotificationType, string> = {
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#5b8def',
}

// ── Toast Item ──────────────────────────────────────────────────────

function ToastItem({
  id,
  type,
  title,
  description,
  action,
  dismissing,
  onDismiss,
}: {
  id: string
  type: NotificationType
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  dismissing: boolean
  onDismiss: (id: string) => void
}) {
  const borderColor = BORDER_COLORS[type]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 14px',
        background: '#181a1e',
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        opacity: dismissing ? 0 : 1,
        transform: dismissing ? 'translateX(100%)' : 'translateX(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        minWidth: 300,
        maxWidth: 420,
        pointerEvents: 'auto',
      }}
    >
      <span style={{ fontSize: 16, lineHeight: '20px' }}>{ICONS[type]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e8ee' }}>{title}</div>
        {description && (
          <div style={{ fontSize: 11, color: '#8892a4', marginTop: 2, lineHeight: 1.4 }}>
            {description}
          </div>
        )}
        {action && (
          <button
            onClick={action.onClick}
            style={{
              marginTop: 6,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 500,
              background: borderColor + '33',
              color: borderColor,
              border: `1px solid ${borderColor}44`,
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(id)}
        style={{
          background: 'none',
          border: 'none',
          color: '#5b6a7a',
          cursor: 'pointer',
          fontSize: 14,
          padding: '2px 4px',
          lineHeight: 1,
        }}
        title="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

// ── Toast Container ─────────────────────────────────────────────────

export function ToastContainer() {
  const { state, dismiss } = useNotification()

  if (state.active.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 8,
        zIndex: 500,
        pointerEvents: 'none',
      }}
      aria-live="polite"
      role="log"
      aria-label="Notifications"
    >
      {state.active.map((n) => (
        <ToastItem
          key={n.id}
          id={n.id}
          type={n.type}
          title={n.title}
          description={n.description}
          action={n.options.action}
          dismissing={n.dismissing}
          onDismiss={dismiss}
        />
      ))}
    </div>
  )
}
