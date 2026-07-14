interface ErrorCardProps {
  message?: string
  description?: string
  onRetry?: () => void
  action?: { label: string; onClick: () => void }
  icon?: string
}

export function ErrorCard({
  message = 'Something went wrong',
  description,
  onRetry,
  action,
  icon = '⚠️',
}: ErrorCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        margin: 16,
        background: '#141517',
        border: '1px solid #3b1f1f',
        borderRadius: 10,
        gap: 10,
      }}
    >
      <span style={{ fontSize: 28 }}>{icon}</span>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#f87171' }}>{message}</div>
      {description && (
        <div style={{ fontSize: 12, color: '#8892a4', maxWidth: 380, textAlign: 'center', lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 500,
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
        {action && (
          <button
            onClick={action.onClick}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 500,
              background: '#25262b',
              color: '#e4e8ee',
              border: '1px solid #2c2e33',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}

/** Wrapper for consistent empty states across the app */
export function EmptyState({
  icon = '📭',
  title = 'Nothing here',
  description,
  action,
}: {
  icon?: string
  title?: string
  description?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        gap: 10,
      }}
    >
      <span style={{ fontSize: 36, opacity: 0.6 }}>{icon}</span>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#8892a4' }}>{title}</div>
      {description && (
        <div style={{ fontSize: 12, color: '#5b6a7a', maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: '6px 16px',
            fontSize: 12,
            fontWeight: 500,
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            marginTop: 8,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
