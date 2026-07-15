/* ═══════════════════════════════════════════════════════════════
   WidgetFrame — стандартная обёртка виджета
   Spec: Workspace_UI_Architecture_v2.md §1.4
   Header (+ Icon, Title, Status, Actions) → Toolbar → Content → Footer
   ═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react'
import { GripHorizontal, Pin, RefreshCw, Maximize2, MoreHorizontal } from 'lucide-react'
import { WidgetSize } from '../widgets/types'
import type { RuntimeStatus } from '../widgets/types'
import { StatusBadge } from './StatusBadge'

interface WidgetFrameProps {
  icon?: ReactNode
  title: string
  status?: RuntimeStatus
  children: ReactNode
  footer?: ReactNode
  size?: WidgetSize
  pinned?: boolean
  onPin?: () => void
  onRefresh?: () => void
  onFullscreen?: () => void
  className?: string
}

export function WidgetFrame({
  icon,
  title,
  status,
  children,
  footer,
  size = WidgetSize.MEDIUM,
  pinned,
  onPin,
  onRefresh,
  onFullscreen,
  className = '',
}: WidgetFrameProps) {
  const sizeClass = {
    SMALL: 'widget-sm',
    MEDIUM: 'widget-md',
    LARGE: 'widget-lg',
    XL: 'widget-xl',
    FULL: 'widget-full',
  }[size]

  return (
    <div className={`widget-frame ${sizeClass} ${className}`}>
      {/* Header */}
      <div className="widget-header">
        {icon && <span className="widget-header-icon">{icon}</span>}
        <span className="widget-header-title">{title}</span>

        {/* Status dot */}
        {status && <StatusBadge status={status} size="sm" />}

        {/* Toolbar actions */}
        <div className="widget-toolbar">
          {onPin && (
            <button className="widget-toolbar-btn" onClick={onPin} title={pinned ? 'Unpin' : 'Pin'}>
              <Pin size={12} fill={pinned ? 'currentColor' : 'none'} />
            </button>
          )}
          {onRefresh && (
            <button className="widget-toolbar-btn" onClick={onRefresh} title="Refresh">
              <RefreshCw size={12} />
            </button>
          )}
          {onFullscreen && (
            <button className="widget-toolbar-btn" onClick={onFullscreen} title="Fullscreen">
              <Maximize2 size={12} />
            </button>
          )}
          <button className="widget-toolbar-btn" title="Drag handle" style={{ cursor: 'grab' }}>
            <GripHorizontal size={12} />
          </button>
          <button className="widget-toolbar-btn" title="More">
            <MoreHorizontal size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="widget-content">
        {children}
      </div>

      {/* Footer */}
      {footer && <div className="widget-footer">{footer}</div>}
    </div>
  )
}
