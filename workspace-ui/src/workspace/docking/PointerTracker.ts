/**
 * PointerTracker — mouse / touch / pointer event tracking
 *
 * Responsibility:
 *   mousedown → pointermove → pointerup
 *
 * Knows NOTHING about Layout Engine, panels, or docking.
 * Pure pointer event abstraction.
 *
 * @since 3.2.3
 */

export interface PointerState {
  /** Whether pointer is currently down */
  down: boolean
  /** Down position (clientX, clientY) */
  startX: number
  startY: number
  /** Current position (clientX, clientY) */
  currentX: number
  currentY: number
  /** Offset from start */
  deltaX: number
  deltaY: number
  /** Whether this is a drag (moved beyond threshold) */
  dragging: boolean
}

export interface PointerTrackerOptions {
  /** Pixel threshold before drag starts (default 5) */
  dragThreshold?: number
  /** Called when drag begins (threshold exceeded) */
  onDragStart?: (state: PointerState) => void
  /** Called on every pointer move while dragging */
  onDragMove?: (state: PointerState) => void
  /** Called when drag ends (pointer up) */
  onDragEnd?: (state: PointerState) => void
  /** Called when pointer goes down (before threshold) */
  onPointerDown?: (state: PointerState) => void
}

export class PointerTracker {
  private opts: Required<PointerTrackerOptions>
  private state: PointerState = this.emptyState()
  private targetElement: HTMLElement | null = null

  constructor(opts?: PointerTrackerOptions) {
    this.opts = {
      dragThreshold: opts?.dragThreshold ?? 5,
      onDragStart: opts?.onDragStart ?? (() => {}),
      onDragMove: opts?.onDragMove ?? (() => {}),
      onDragEnd: opts?.onDragEnd ?? (() => {}),
      onPointerDown: opts?.onPointerDown ?? (() => {}),
    }
  }

  /** Attach to an element */
  attach(element: HTMLElement): void {
    this.detach()
    this.targetElement = element
    element.addEventListener('pointerdown', this.handlePointerDown)
    // Prevent context menu on panels
    element.addEventListener('contextmenu', this.preventContextMenu)
  }

  /** Detach from current element */
  detach(): void {
    if (this.targetElement) {
      this.targetElement.removeEventListener('pointerdown', this.handlePointerDown)
      this.targetElement.removeEventListener('contextmenu', this.preventContextMenu)
      this.targetElement = null
    }
    this.removeMoveListeners()
    this.state = this.emptyState()
  }

  /** Whether currently in drag */
  get isDragging(): boolean {
    return this.state.dragging
  }

  /** Current pointer state */
  get pointerState(): PointerState {
    return { ...this.state }
  }

  // ── Private ──

  private emptyState(): PointerState {
    return {
      down: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      deltaX: 0,
      deltaY: 0,
      dragging: false,
    }
  }

  private handlePointerDown = (e: PointerEvent): void => {
    this.state = {
      down: true,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      deltaX: 0,
      deltaY: 0,
      dragging: false,
    }

    // Capture pointer on the element
    if (this.targetElement) {
      this.targetElement.setPointerCapture(e.pointerId)
    }

    // Add global move/up listeners
    document.addEventListener('pointermove', this.handlePointerMove)
    document.addEventListener('pointerup', this.handlePointerUp)

    this.opts.onPointerDown(this.state)
  }

  private handlePointerMove = (e: PointerEvent): void => {
    const { startX, startY, dragging } = this.state

    this.state.currentX = e.clientX
    this.state.currentY = e.clientY
    this.state.deltaX = e.clientX - startX
    this.state.deltaY = e.clientY - startY

    // Check drag threshold
    if (!dragging) {
      const dist = Math.sqrt(
        (e.clientX - startX) ** 2 + (e.clientY - startY) ** 2,
      )
      if (dist >= this.opts.dragThreshold) {
        this.state.dragging = true
        this.opts.onDragStart(this.state)
        return
      }
    } else {
      this.opts.onDragMove(this.state)
    }
  }

  private handlePointerUp = (e: PointerEvent): void => {
    this.state.currentX = e.clientX
    this.state.currentY = e.clientY
    this.state.deltaX = e.clientX - this.state.startX
    this.state.deltaY = e.clientY - this.state.startY

    this.removeMoveListeners()

    if (this.state.dragging) {
      this.opts.onDragEnd(this.state)
    }

    this.state = this.emptyState()
  }

  private removeMoveListeners(): void {
    document.removeEventListener('pointermove', this.handlePointerMove)
    document.removeEventListener('pointerup', this.handlePointerUp)
  }

  private preventContextMenu = (e: Event): void => {
    e.preventDefault()
  }
}
