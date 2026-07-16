// ── InteractionManager — Raw pointer input abstraction ──
//
// Normalises mouse / touch / pen events into a single
// InteractionEvent stream for downstream consumers.
//
// @since 3.6.1

import type { BuilderEventBus } from '../runtime/BuilderEventBus'
import type { InteractionEvent, PointerState, DragState } from '../types'

export interface InteractionHandler {
  onPointerDown?(event: InteractionEvent): void
  onPointerMove?(event: InteractionEvent): void
  onPointerUp?(event: InteractionEvent): void
  onDrag?(state: DragState): void
  onClick?(event: InteractionEvent): void
  onDoubleClick?(event: InteractionEvent): void
  onWheel?(event: InteractionEvent, delta: number): void
}

export class InteractionManager {
  private _element: HTMLElement
  private _handlers: InteractionHandler[] = []
  private _pointer: PointerState = { isDown: false, position: { x: 0, y: 0 }, startPosition: null, timestamp: 0 }
  private _eventBus: BuilderEventBus | null = null

  constructor(element: HTMLElement) {
    this._element = element
  }

  connect(eventBus: BuilderEventBus): void {
    this._eventBus = eventBus
    this._attachListeners()
  }

  disconnect(): void {
    this._detachListeners()
    this._eventBus = null
  }

  registerHandler(handler: InteractionHandler): void {
    this._handlers.push(handler)
  }

  removeHandler(handler: InteractionHandler): void {
    const idx = this._handlers.indexOf(handler)
    if (idx >= 0) this._handlers.splice(idx, 1)
  }

  get pointer(): Readonly<PointerState> {
    return this._pointer
  }

  // ── Internal ──

  private _attachListeners(): void {
    const el = this._element
    el.addEventListener('pointerdown', this._onPointerDown)
    el.addEventListener('pointermove', this._onPointerMove)
    el.addEventListener('pointerup', this._onPointerUp)
    el.addEventListener('wheel', this._onWheel, { passive: false })
  }

  private _detachListeners(): void {
    const el = this._element
    el.removeEventListener('pointerdown', this._onPointerDown)
    el.removeEventListener('pointermove', this._onPointerMove)
    el.removeEventListener('pointerup', this._onPointerUp)
    el.removeEventListener('wheel', this._onWheel)
  }

  private _makeEvent(e: PointerEvent | WheelEvent): InteractionEvent {
    const rect = this._element.getBoundingClientRect()
    return {
      type: e.type as InteractionEvent['type'],
      position: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      screenPosition: { x: e.clientX, y: e.clientY },
      buttons: e.buttons,
      modifiers: {
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      },
      timestamp: Date.now(),
    }
  }

  private _onPointerDown = (e: PointerEvent): void => {
    this._pointer = {
      isDown: true,
      position: { x: e.clientX, y: e.clientY },
      startPosition: { x: e.clientX, y: e.clientY },
      timestamp: Date.now(),
    }
    const event = this._makeEvent(e)
    for (const h of this._handlers) h.onPointerDown?.(event)
    this._eventBus?.emit('builder:pointer:down', event)
  }

  private _onPointerMove = (e: PointerEvent): void => {
    const prev = { ...this._pointer.position }
    this._pointer.position = { x: e.clientX, y: e.clientY }

    const event = this._makeEvent(e)
    for (const h of this._handlers) h.onPointerMove?.(event)

    if (this._pointer.isDown) {
      const drag: DragState = {
        start: this._pointer.startPosition!,
        current: this._pointer.position,
        delta: {
          x: this._pointer.position.x - prev.x,
          y: this._pointer.position.y - prev.y,
        },
        totalDelta: {
          x: this._pointer.position.x - this._pointer.startPosition!.x,
          y: this._pointer.position.y - this._pointer.startPosition!.y,
        },
      }
      for (const h of this._handlers) h.onDrag?.(drag)
      this._eventBus?.emit('builder:drag', drag)
    }

    this._eventBus?.emit('builder:pointer:move', event)
  }

  private _onPointerUp = (e: PointerEvent): void => {
    this._pointer.isDown = false
    const event = this._makeEvent(e)
    for (const h of this._handlers) h.onPointerUp?.(event)
    this._eventBus?.emit('builder:pointer:up', event)
    // Click detection
    if (this._pointer.startPosition) {
      const dx = e.clientX - this._pointer.startPosition.x
      const dy = e.clientY - this._pointer.startPosition.y
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
        for (const h of this._handlers) h.onClick?.(event)
        this._eventBus?.emit('builder:click', event)
      }
    }
    this._pointer.startPosition = null
  }

  private _onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    const event = this._makeEvent(e)
    for (const h of this._handlers) h.onWheel?.(event, e.deltaY)
    this._eventBus?.emit('builder:wheel', { event, delta: e.deltaY })
  }
}
