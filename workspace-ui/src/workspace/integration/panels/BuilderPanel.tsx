/**
 * BuilderPanel.tsx — Thin React host for Strategy Builder
 *
 * Thin wrapper that creates the canvas rendering surface
 * and the builder runtime pipeline. No business logic.
 *
 * @since 3.7.2
 */

import { useRef, useEffect, type ReactNode } from 'react'
import { CanvasManager } from '../../strategy-builder/canvas/CanvasManager'

/**
 * BuilderPanel — Thin React host.
 * Creates the HTML canvas and mounts the CanvasManager.
 * The CanvasManager handles all rendering.
 */
export function BuilderPanel(): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const canvasManager = new CanvasManager(container)
    canvasManager.resize(container.clientWidth, container.clientHeight)

    return () => {
      canvasManager.destroy()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#0d1117',
      }}
    />
  )
}
