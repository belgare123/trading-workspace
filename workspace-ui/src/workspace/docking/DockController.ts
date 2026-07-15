/**
 * DockController — orchestrator for drag-and-drop docking
 *
 * Finite state machine with explicit transitions:
 *   Idle → Pressed → Dragging → HoveringTarget → Dropping → Idle
 *                ↘                    ↙
 *              Cancelled → Idle
 *
 * Ties together:
 *   PointerTracker → HitTesting → DropResolver → LayoutEngine → PanelRuntime
 *
 * Publishes dock events to EventBus (when available)
 * Records operations to OperationHistory with before/after snapshots
 *
 * Imports LayoutEngine but does NOT extend or modify it.
 * All interactions through existing LayoutEngine API.
 *
 * @since 3.2.3
 */

import type { LayoutEngine } from '../layout/LayoutEngine'
import type { EventBus } from '../../runtime/EventBus'
import type { Panel } from '../layout/types'
import { PointerTracker } from './PointerTracker'
import type { PointerState } from './PointerTracker'
import { hitTest, computePanelBounds } from './HitTesting'
import type { PanelBounds } from './HitTesting'
import { calculateZoneRect } from './SnapEngine'
import type { ZoneRect } from './SnapEngine'
import { DropResolver, clonePanels } from './DropResolver'
import { OperationHistory } from './OperationHistory'
import { DOCK_EVENTS, EMPTY_DRAG_STATE } from './types'
import type { DockDragState, DockState } from './types'

export interface DockControllerOptions {
  engine: LayoutEngine
  eventBus?: EventBus
  /** Source name for EventBus events */
  source?: string
}

export interface DockControllerState {
  /** Current machine state */
  machineState: DockState
  dragState: DockDragState
  zoneRect: ZoneRect | null
  panelBounds: PanelBounds[]
}

export class DockController {
  readonly engine: LayoutEngine
  readonly history: OperationHistory
  readonly dropResolver: DropResolver
  readonly pointerTracker: PointerTracker
  private eventBus?: EventBus
  private source: string
  private _onStateChange?: (state: DockControllerState) => void

  // Machine state
  private _machineState: DockState = 'idle'

  // Internal state
  private _dragState: DockDragState = { ...EMPTY_DRAG_STATE }
  private _zoneRect: ZoneRect | null = null
  private _panelBounds: PanelBounds[] = []
  private containerRect: DOMRect | null = null
  /** Snapshot of panels captured when drag started (for history) */
  private _beforePanels: Panel[] = []

  constructor(opts: DockControllerOptions) {
    this.engine = opts.engine
    this.eventBus = opts.eventBus
    this.source = opts.source || 'dock-manager'
    this.dropResolver = new DropResolver(opts.engine)
    this.history = new OperationHistory()

    this.pointerTracker = new PointerTracker({
      dragThreshold: 5,
      onPointerDown: this.handlePointerDown,
      onDragStart: this.handleDragStart,
      onDragMove: this.handleDragMove,
      onDragEnd: this.handleDragEnd,
    })
  }

  // ── Public API ──

  /** Subscribe to state changes for React reconciliation */
  subscribe(cb: (state: DockControllerState) => void): () => void {
    this._onStateChange = cb
    return () => { this._onStateChange = undefined }
  }

  /** Attach to a container element */
  attach(container: HTMLElement): void {
    this.pointerTracker.attach(container)
  }

  /** Detach from container */
  detach(): void {
    this.pointerTracker.detach()
    this.transitionTo('idle', 'detach')
  }

  /** Current drag state (read-only) */
  get dragState(): DockDragState {
    return { ...this._dragState }
  }

  /** Current machine state */
  get machineState(): DockState {
    return this._machineState
  }

  /** Update container rect for hit testing */
  updateContainerRect(rect: DOMRect): void {
    this.containerRect = rect
    this._panelBounds = computePanelBounds(
      this.engine.current.panels,
      rect.width,
      rect.height,
    )
  }

  // ── State Machine ──

  private transitionTo(next: DockState, reason: string): void {
    const prev = this._machineState
    this._machineState = next

    this.emitEvent(DOCK_EVENTS.STATE_CHANGED, {
      from: prev,
      to: next,
      reason,
    })
  }

  // ── Private: Pointer handlers ──

  private handlePointerDown = (state: PointerState): void => {
    if (!this.containerRect) return

    const target = hitTest(
      state.startX - this.containerRect.left,
      state.startY - this.containerRect.top,
      this._panelBounds,
    )
    if (!target) return

    this._dragState.sourcePanelId = target.panelId
    this._dragState.offset = {
      x: state.startX - this.containerRect.left,
      y: state.startY - this.containerRect.top,
    }

    this.transitionTo('pressed', `pointer down on ${target.panelId}`)
    this.notifyState()
  }

  private handleDragStart = (state: PointerState): void => {
    if (!this._dragState.sourcePanelId) return

    // Capture before-snapshot for history
    this._beforePanels = clonePanels(this.engine.current.panels)

    this._dragState.active = true
    this._dragState.ghostPosition = {
      x: state.currentX,
      y: state.currentY,
    }

    this.transitionTo('dragging', 'drag threshold exceeded')
    this.emitEvent(DOCK_EVENTS.DRAG_START, {
      panelId: this._dragState.sourcePanelId,
      position: { x: state.currentX, y: state.currentY },
    })

    this.notifyState()
  }

  private handleDragMove = (state: PointerState): void => {
    if (!this._dragState.active) return

    this._dragState.ghostPosition = {
      x: state.currentX,
      y: state.currentY,
    }

    // Hit test
    if (this.containerRect) {
      const pointerX = state.currentX - this.containerRect.left
      const pointerY = state.currentY - this.containerRect.top
      const target = hitTest(pointerX, pointerY, this._panelBounds)

      // Handle enter/leave
      const prevId = this._dragState.currentTarget?.panelId
      const newId = target?.panelId

      if (newId && newId !== prevId) {
        this.emitEvent(DOCK_EVENTS.DRAG_ENTER, { panelId: newId })
      }
      if (prevId && prevId !== newId) {
        this.emitEvent(DOCK_EVENTS.DRAG_LEAVE, { panelId: prevId })
      }

      this._dragState.currentTarget = target

      // Transition to hovering-target if we have a valid target
      if (target && this._machineState === 'dragging') {
        this.transitionTo('hovering-target', `hit ${target.panelId} ${target.zone}`)
      } else if (!target && this._machineState === 'hovering-target') {
        this.transitionTo('dragging', 'left target area')
      }

      // Update zone rect for preview
      if (target) {
        const panelBound = this._panelBounds.find(b => b.id === target.panelId)
        if (panelBound) {
          this._zoneRect = calculateZoneRect(panelBound, target.zone)
        } else {
          this._zoneRect = null
        }
      } else {
        this._zoneRect = null
      }
    }

    this.emitEvent(DOCK_EVENTS.DRAG_MOVE, {
      panelId: this._dragState.sourcePanelId,
      target: this._dragState.currentTarget,
      position: { x: state.currentX, y: state.currentY },
    })

    this.notifyState()
  }

  private handleDragEnd = (_state: PointerState): void => {
    const sourcePanelId = this._dragState.sourcePanelId
    const target = this._dragState.currentTarget

    if (sourcePanelId && target && this._machineState === 'hovering-target') {
      this.transitionTo('dropping', `drop on ${target.panelId} ${target.zone}`)

      const sourcePanel = this.engine.current.panels.find(p => p.id === sourcePanelId)
      if (sourcePanel) {
        // Don't allow self-dock (same panel, non-center zone)
        const isSelfDock = target.panelId === sourcePanelId && target.zone !== 'center'
        if (!isSelfDock) {
          // 1. Generate command (pure)
          const command = this.dropResolver.resolve(target, sourcePanel)

          if (command) {
            // 2. Execute command on LayoutEngine
            const resolution = this.dropResolver.execute(command)

            if (resolution.success) {
              // 3. Record with before/after snapshots
              const afterPanels = clonePanels(this.engine.current.panels)
              this.history.record(
                resolution.operation as any,
                command,
                this._beforePanels,
                afterPanels,
                resolution.description,
              )

              // 4. Emit events
              this.emitEvent(DOCK_EVENTS.DRAG_DROP, {
                sourcePanelId,
                target,
                command,
                resolution,
              })

              this.emitEvent(DOCK_EVENTS.LAYOUT_CHANGED, {
                operation: resolution.operation,
                command,
                description: resolution.description,
              })
            } else {
              this.emitEvent(DOCK_EVENTS.DRAG_DROP, {
                sourcePanelId,
                target,
                command,
                resolution,
                error: 'Command execution failed',
              })
            }
          }
        }
      }
    } else if (sourcePanelId && this._machineState === 'dragging') {
      // Dragging ended without hitting a target — cancelled
      this.transitionTo('cancelled', 'no valid target')
    }

    // Reset state
    this._dragState = { ...EMPTY_DRAG_STATE }
    this._zoneRect = null
    this._beforePanels = []
    this.transitionTo('idle', 'drag ended')

    this.notifyState()
  }

  // ── EventBus ──

  private emitEvent(topic: string, payload: Record<string, unknown>): void {
    if (!this.eventBus) return
    try {
      this.eventBus.emit(topic, payload, { source: this.source })
    } catch {
      // EventBus failures are non-critical for docking UX
    }
  }

  // ── State notifications ──

  private notifyState(): void {
    this._onStateChange?.({
      machineState: this._machineState,
      dragState: this._dragState,
      zoneRect: this._zoneRect,
      panelBounds: this._panelBounds,
    })
  }
}
