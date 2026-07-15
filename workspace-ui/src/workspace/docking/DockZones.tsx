/**
 * DockZones — interactive zone indicators on the workspace
 *
 * Renders semi-transparent zone overlays when a drag is active,
 * showing where the panel can be docked.
 *
 * @since 3.2.3
 */

import type { PanelBounds } from './HitTesting'
import { calculateZoneRect } from './SnapEngine'
import type { ReactNode } from 'react'

export interface DockZonesProps {
  /** All panel bounds to render zones for */
  bounds: PanelBounds[]
  /** The currently hovered target (to highlight) */
  activeTargetId?: string
  /** Whether zones are visible */
  visible: boolean
}

const ZONES: Array<'left' | 'right' | 'top' | 'bottom' | 'center'> = [
  'left', 'right', 'top', 'bottom', 'center',
]

const zoneStyle = (isActive: boolean): React.CSSProperties => ({
  position: 'absolute',
  borderRadius: 3,
  pointerEvents: 'none',
  zIndex: 999,
  transition: 'opacity 120ms ease',
  opacity: isActive ? 0.4 : 0.15,
})

export function DockZones({ bounds, activeTargetId, visible }: DockZonesProps): ReactNode {
  if (!visible) return null

  return (
    <>
      {bounds.map(b => {
        const zones = ZONES.map(zone => {
          const rect = calculateZoneRect(b, zone)
          return { zone, rect, isActive: activeTargetId === b.id }
        })

        return zones.map(({ zone, rect, isActive }) => {
          const color = isActive
            ? 'rgba(74, 158, 255, 0.4)'
            : 'rgba(74, 158, 255, 0.12)'

          return (
            <div
              key={`${b.id}-${zone}`}
              style={{
                ...zoneStyle(isActive),
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                background: color,
                border: isActive
                  ? '1px solid rgba(74, 158, 255, 0.5)'
                  : '1px solid rgba(74, 158, 255, 0.08)',
              }}
            />
          )
        })
      })}
    </>
  )
}
