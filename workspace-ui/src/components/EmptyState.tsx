/* ═══════════════════════════════════════════════════════════════
   EmptyState — единый шаблон отсутствия данных
   Spec: Workspace_UI_Architecture_v2.md §3.3
   Icon + Title + Description + Primary Action + Optional Secondary
   ═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        gap: 12,
        textAlign: 'center',
      }}
    >
      {/* Icon */}
      <div style={{ color: 'var(--text-muted)', opacity: 0.5, fontSize: 32, lineHeight: 1 }}>
        {icon}
      </div>

      {/* Title */}
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
        {title}
      </div>

      {/* Description */}
      <div style={{ fontSize: 13, color: 'var(--text-sec)', maxWidth: 280, lineHeight: 1.5 }}>
        {description}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {actionLabel && onAction && (
          <button className="btn btn-primary" onClick={onAction}>
            {actionLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button className="btn btn-ghost" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}
