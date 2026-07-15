/**
 * DockManager — main React component for dockable workspace
 *
 * Orchestrates:
 * - Container rendering (where panels live)
 * - Controller initialization and lifecycle
 * - Container resize tracking for hit testing
 * - React child rendering on top of the panel host
 *
 * Usage:
 *   <DockManager>
 *     <PanelHost />
 *   </DockManager>
 *
 * @since 3.2.3
 */

import { useRef, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { LayoutEngine, layoutEngine } from '../layout'
import type { EventBus } from '../../runtime/EventBus'
import { DockController } from './DockController'
import type { DockControllerState } from './DockController'
import { DockOverlay } from './DockOverlay'

export interface DockManagerProps {
  /** LayoutEngine instance */
  engine?: LayoutEngine
  /** EventBus for emitting dock events */
  eventBus?: EventBus
  /** Children (typically PanelHost) */
  children?: ReactNode
}

export function DockManager({ engine = layoutEngine, eventBus, children }: DockManagerProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<DockController | null>(null)
  const [state, setState] = useState<DockControllerState | null>(null)
  const dragActive = state?.dragState.active ?? false

  // Initialize controller once
  if (!controllerRef.current) {
    controllerRef.current = new DockController({ engine, eventBus })
  }

  const controller = controllerRef.current;

  // Attach controller to container after mount
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    controller.attach(container)

    return () => {
      controller.detach()
    }
  }, [controller])

  // Subscribe to controller state changes
  useEffect(() => {
    const unsub = controller.subscribe((newState: DockControllerState) => {
      setState(newState)
    })
    return unsub
  }, [controller])

  // Observe container resize for up-to-date hit testing
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateContainerRect = () => {
      const rect = container.getBoundingClientRect()
      controller.updateContainerRect(rect)
    }

    updateContainerRect()

    const observer = new ResizeObserver(updateContainerRect)
    observer.observe(container)

    return () => observer.disconnect()
  }, [controller])

  // If no children, render instructions
  if (!children) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#555',
            fontSize: 14,
          }}
        >
          Use PanelHost as a child to render panels
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    >
      {/* Panel host renders panels */}
      <div className="panel-host-wrapper" style={{ width: '100%', height: '100%' }}>
        {children}
      </div>

      {/* Docking overlays */}
      {dragActive && (
        <div
          className="docking-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        >
          <DockOverlay
            dragState={state?.dragState ?? controller.dragState}
            panelBounds={state?.panelBounds ?? []}
            zoneRect={state?.zoneRect ?? null}
          />
        </div>
      )}

      {/* Full-screen blocking overlay during drag — captures all pointer events */}
      {dragActive && (
        <div
          className="dnd-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 5000,
            cursor: 'grabbing',
          }}
        />
      )}
    </div>
  )
}
