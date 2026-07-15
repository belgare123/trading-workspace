/**
 * DragGhost — floating panel preview that follows the cursor during drag
 *
 * Shows a semi-transparent copy of the panel being dragged.
 *
 * @since 3.2.3
 */

import type { ReactNode } from 'react'

export interface DragGhostProps {
  visible: boolean
  title: string
  x: number
  y: number
  width?: number
  height?: number
}

export function DragGhost({ visible, title, x, y, width, height }: DragGhostProps): ReactNode {
  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width: width || 200,
        height: height || 60,
        background: 'rgba(30, 32, 40, 0.9)',
        border: '1px solid rgba(74, 158, 255, 0.5)',
        borderRadius: 4,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        transform: 'translate(-50%, -50%)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <span
        style={{
          color: '#c0c4cc',
          fontSize: 13,
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </span>
    </div>
  )
}
