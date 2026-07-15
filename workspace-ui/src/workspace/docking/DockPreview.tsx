/**
 * DockPreview — visual overlay showing where the panel will dock
 *
 * Renders a highlighted zone preview when dragging over a panel.
 *
 * @since 3.2.3
 */

import type { ZoneRect } from './SnapEngine'
import type { ReactNode } from 'react'

export interface DockPreviewProps {
  zoneRect: ZoneRect | null
}

const ZONE_COLORS: Record<string, string> = {
  left: 'rgba(74, 158, 255, 0.15)',
  right: 'rgba(74, 158, 255, 0.15)',
  top: 'rgba(74, 158, 255, 0.15)',
  bottom: 'rgba(74, 158, 255, 0.15)',
  center: 'rgba(74, 158, 255, 0.10)',
  floating: 'rgba(74, 158, 255, 0.08)',
}

const ZONE_BORDERS: Record<string, string> = {
  left: '2px solid rgba(74, 158, 255, 0.6)',
  right: '2px solid rgba(74, 158, 255, 0.6)',
  top: '2px solid rgba(74, 158, 255, 0.6)',
  bottom: '2px solid rgba(74, 158, 255, 0.6)',
  center: '2px dashed rgba(74, 158, 255, 0.4)',
  floating: '2px dashed rgba(74, 158, 255, 0.3)',
}

export function DockPreview({ zoneRect }: DockPreviewProps): ReactNode {
  if (!zoneRect) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: zoneRect.left,
        top: zoneRect.top,
        width: zoneRect.width,
        height: zoneRect.height,
        background: ZONE_COLORS[zoneRect.zone] || 'rgba(74,158,255,0.1)',
        border: ZONE_BORDERS[zoneRect.zone] || '2px dashed rgba(74,158,255,0.5)',
        borderRadius: 4,
        pointerEvents: 'none',
        zIndex: 1000,
        transition: 'all 80ms ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          color: 'rgba(74, 158, 255, 0.7)',
          fontSize: 11,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {zoneRect.zone === 'center' ? 'Add Tab' : `Dock ${zoneRect.zone}`}
      </span>
    </div>
  )
}
