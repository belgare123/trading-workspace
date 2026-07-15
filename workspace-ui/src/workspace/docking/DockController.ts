/**
 * DockController — orchestrator for drag-and-drop docking
 *
 * ── Finite State Machine with strict transitions ──
 *
 *   Idle ─────[pointerDown]─────► Pressed
 *   Pressed ──[dragThreshold]───► Dragging
 *   Pressed ──[pointerUp]───────► Idle        (drag aborted)
 *   Dragging ──[hitTarget]──────► HoveringTarget
 *   Dragging ──[noTarget]───────► Cancelled
 *   HoveringTarget ─[leave]─────► Dragging
 *   HoveringTarget ─[drop]──────► Dropping
 *   Dropping ────────────────────► Idle        (cleanup)
 *   Cancelled ───────────────────► Idle        (cleanup)
 *
 * Any transition not in this map is a runtime error.
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

// ── Strict transition map ──
// KEY:   current state
// VALUE: allowed next states (empty array means no transitions allowed)
// A state can always transition to itself (self-loop, useful for reset).
const TRANSITIONS: Record<DockState, DockState[]> = {
  idle:              ['pressed'],
  pressed:           ['dragging', 'idle'],
  dragging:          ['hovering-target', 'cancelled'],
  'hovering-target': ['dragging', 'dropping'],
  dropping:          ['idle'],
  cancelled:         ['idle'],
}

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

  /**
   * Transition to next state.
   * Throws if the transition is not defined in the TRANSITIONS map.
   * A self-loop (current → same) is always allowed for cleanup.
   */
  private transitionTo(next: DockState, reason: string): void {
    const prev = this._machineState

    // Always allow self-loop (same state, e.g. reset in idle)
    if (next !== prev) {
      const allowed = TRANSITIONS[prev]
      if (!allowed || !allowed.includes(next)) {
        throw new Error(
          `Forbidden FSM transition: ${prev} → ${next} (${reason}). ` +
          `Allowed from ${prev}: [${allowed?.join(', ') ?? 'none'}].`
        )
      }
    }

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

      // FSM: hovering-target ↔ dragging
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
        // 1. Generate command (PURE — resolve has no side effects)
        const command = this.dropResolver.resolve(target, sourcePanel)

        if (command) {
          // 2. Validate before executing
          const validation = this.dropResolver.validate(command)
          if (!validation.valid) {
            this.emitEvent(DOCK_EVENTS.DRAG_DROP, {
              sourcePanelId,
              target,
              command,
              error: `Validation failed: ${validation.errors.join('; ')}`,
            })
            this.resetAndNotify()
            return
          }

          // 3. Execute command on LayoutEngine
          const resolution = this.dropResolver.execute(command)

          if (resolution.success) {
            // 4. Record with before/after snapshots
            const afterPanels = clonePanels(this.engine.current.panels)
            this.history.record(
              resolution.operation as any,
              command,
              this._beforePanels,
              afterPanels,
              resolution.description,
            )

            // 5. Emit events
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
    } else if (sourcePanelId && this._machineState === 'dragging') {
      // Dragging ended without hitting a target → cancelled
      this.transitionTo('cancelled', 'no valid target')
    }

    this.resetAndNotify()
  }

  /** Reset drag state and return to idle */
  private resetAndNotify(): void {
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
