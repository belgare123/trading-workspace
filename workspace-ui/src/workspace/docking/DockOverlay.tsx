/**
 * DockOverlay — full-screen overlay combining DockZones, DockPreview, and DragGhost
 *
 * Rendered on top of the PanelHost during drag operations.
 *
 * @since 3.2.3
 */

import type { ReactNode } from 'react'
import type { DockDragState } from './types'
import type { PanelBounds } from './HitTesting'
import type { ZoneRect } from './SnapEngine'
import { DockZones } from './DockZones'
import { DockPreview } from './DockPreview'
import { DragGhost } from './DragGhost'

export interface DockOverlayProps {
  dragState: DockDragState
  panelBounds: PanelBounds[]
  zoneRect: ZoneRect | null
}

export function DockOverlay({ dragState, panelBounds, zoneRect }: DockOverlayProps): ReactNode {
  if (!dragState.active) return null

  // Get ghost position relative to the viewport (for fixed positioning)
  const ghostX = dragState.ghostPosition.x
  const ghostY = dragState.ghostPosition.y

  return (
    <>
      {/* Zone indicators */}
      <DockZones
        bounds={panelBounds}
        activeTargetId={dragState.currentTarget?.panelId}
        visible={dragState.active}
      />

      {/* Preview overlay for current target */}
      <DockPreview zoneRect={zoneRect} />

      {/* Drag ghost */}
      <DragGhost
        visible={dragState.active}
        title={dragState.sourcePanelId || 'Panel'}
        x={ghostX}
        y={ghostY}
      />
    </>
  )
}
